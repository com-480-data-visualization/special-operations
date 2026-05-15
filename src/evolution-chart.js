/**
 * D3 line chart that keeps the time evolution visible while the map animates.
 */

import * as d3 from "d3";
import {
  COUNTRY_COLORS,
  REGION_COLORS,
  calculateRegionMetricValue,
  formatMetricValue,
  getCountryMetricValue,
} from "./data-model.js";

const WIDTH = 960;
const HEIGHT = 280;
const MARGIN = { top: 20, right: 190, bottom: 42, left: 86 };
const LABEL_GAP = 16;

/**
 * Creates the evolution chart and returns its update function.
 *
 * @param {HTMLElement} container Element that receives the SVG.
 * @param {object} data Loaded spider data.
 * @returns {(options: object) => void} Update function.
 */
export function createEvolutionChart(container, data) {
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
    .attr("role", "img")
    .attr("aria-label", "Evolution of selected countries or regions over time");

  const axisLayer = svg.append("g").attr("class", "evolution-axes");
  const lineLayer = svg.append("g").attr("class", "evolution-lines");
  const markerLayer = svg.append("g").attr("class", "evolution-marker");
  const labelLayer = svg.append("g").attr("class", "evolution-labels");

  const xScale = d3
    .scaleLinear()
    .domain([data.baselineYear, data.latestYear])
    .range([MARGIN.left, WIDTH - MARGIN.right]);

  /**
   * Updates lines and current-year marker.
   *
   * @param {object} options Active chart state.
   */
  function update(options) {
    const series = buildSeries(data, options);
    const maxValue = Math.max(
      2,
      d3.max(series.flatMap((entry) => entry.points), (point) => point.value ?? 0) ?? 2,
    );
    const yScale = d3
      .scaleLinear()
      .domain([0, maxValue])
      .nice()
      .range([HEIGHT - MARGIN.bottom, MARGIN.top]);
    const line = d3
      .line()
      .defined((point) => point.value !== null)
      .x((point) => xScale(point.year))
      .y((point) => yScale(point.value ?? 0))
      .curve(d3.curveMonotoneX);

    renderAxes(axisLayer, xScale, yScale, data, options);

    lineLayer
      .selectAll("path")
      .data(series, (entry) => entry.id)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", (entry) => entry.color)
      .attr("stroke-width", 2.5)
      .attr("d", (entry) => line(entry.points));

    renderLabels(labelLayer, series, xScale, yScale, data, options);
    renderMarker(markerLayer, data.years[options.yearIndex], xScale);
  }

  return update;
}

/**
 * Builds country or region series for the selected indicator.
 *
 * @param {object} data Loaded spider data.
 * @param {object} options Active state.
 * @returns {object[]} Renderable line series.
 */
function buildSeries(data, options) {
  if (options.selectionMode === "regions") {
    return options.selectedRegions.map((region) => ({
      id: region,
      label: region,
      color: REGION_COLORS[region],
      points: data.years.map((year, yearIndex) => ({
        year,
        value: calculateRegionMetricValue(
          data,
          region,
          options.axis,
          yearIndex,
          options.valueMode,
        ),
      })),
    }));
  }

  return options.selectedIso3.map((iso3) => {
    const country = data.countries[iso3];
    return {
      id: iso3,
      label: iso3,
      color: COUNTRY_COLORS[iso3],
      points: data.years.map((year, yearIndex) => ({
        year,
        value: getCountryMetricValue(country, options.axis, yearIndex, options.valueMode),
      })),
    };
  });
}

/**
 * Draws axes and baseline.
 *
 * @param {d3.Selection} layer Axis layer.
 * @param {d3.ScaleLinear} xScale Year scale.
 * @param {d3.ScaleLinear} yScale Value scale.
 */
function renderAxes(layer, xScale, yScale, data, options) {
  const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat((year) => String(Math.round(year)));
  const yAxis = d3
    .axisLeft(yScale)
    .ticks(4)
    .tickFormat((value) =>
      formatMetricValue(data, options.axis, Number(value), options.valueMode),
    );

  layer
    .selectAll("g.x-axis")
    .data(["x"])
    .join("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${HEIGHT - MARGIN.bottom})`)
    .call(xAxis);

  layer
    .selectAll("g.y-axis")
    .data(["y"])
    .join("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${MARGIN.left},0)`)
    .call(yAxis);

  layer
    .selectAll("line.baseline")
    .data(options.valueMode === "growth" ? [1] : [])
    .join("line")
    .attr("class", "baseline")
    .attr("x1", MARGIN.left)
    .attr("x2", WIDTH - MARGIN.right)
    .attr("y1", yScale(1))
    .attr("y2", yScale(1));
}

/**
 * Places labels at the latest available point.
 *
 * @param {d3.Selection} layer Label layer.
 * @param {object[]} series Line series.
 * @param {d3.ScaleLinear} xScale Year scale.
 * @param {d3.ScaleLinear} yScale Value scale.
 */
function renderLabels(layer, series, xScale, yScale, data, options) {
  const labels = layoutLabels(
    series
      .map((entry) => {
        const point = [...entry.points].reverse().find((candidate) => candidate.value !== null);
        return {
          ...entry,
          point,
          labelY: point ? yScale(point.value) : null,
        };
      })
      .filter((entry) => entry.point),
  );

  layer
    .selectAll("text")
    .data(labels, (entry) => entry.id)
    .join("text")
    .attr("x", xScale(data.latestYear) + 12)
    .attr("y", (entry) => entry.labelY + 4)
    .attr("fill", (entry) => entry.color)
    .text((entry) => {
      const value = formatMetricValue(
        data,
        options.axis,
        entry.point.value,
        options.valueMode,
      );
      return `${entry.label} ${value}`;
    });
}

/**
 * Separates end labels so nearby lines remain legible.
 *
 * @param {object[]} labels Labels with preferred y positions.
 * @returns {object[]} Labels with adjusted y positions.
 */
function layoutLabels(labels) {
  const minY = MARGIN.top + 4;
  const maxY = HEIGHT - MARGIN.bottom - 4;
  const sorted = [...labels].sort((a, b) => a.labelY - b.labelY);

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    current.labelY = Math.max(current.labelY, previous.labelY + LABEL_GAP);
  }

  const overflow = sorted.length > 0 ? sorted[sorted.length - 1].labelY - maxY : 0;
  if (overflow > 0) {
    for (const label of sorted) label.labelY -= overflow;
  }

  for (let index = sorted.length - 2; index >= 0; index -= 1) {
    const next = sorted[index + 1];
    const current = sorted[index];
    current.labelY = Math.min(current.labelY, next.labelY - LABEL_GAP);
  }

  for (const label of sorted) {
    label.labelY = Math.max(minY, Math.min(maxY, label.labelY));
  }

  return sorted;
}

/**
 * Draws the current year marker.
 *
 * @param {d3.Selection} layer Marker layer.
 * @param {number} year Active year.
 * @param {d3.ScaleLinear} xScale Year scale.
 */
function renderMarker(layer, year, xScale) {
  layer
    .selectAll("line")
    .data([year])
    .join("line")
    .attr("x1", xScale(year))
    .attr("x2", xScale(year))
    .attr("y1", MARGIN.top)
    .attr("y2", HEIGHT - MARGIN.bottom);
}
