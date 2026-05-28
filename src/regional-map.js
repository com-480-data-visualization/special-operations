/**
 * D3 map/scatter view for the economic data story. Map mode colors countries
 * by the selected indicator; scatter mode compares prosperity and markets.
 */

import * as d3 from "d3";
import { feature } from "topojson-client";
import worldCountries from "world-atlas/countries-110m.json";
import {
  COUNTRY_COLORS,
  COUNTRY_METADATA,
  REGION_COLORS,
  REGION_ORDER,
  WORLD_ATLAS_ID_TO_ISO3,
  calculateRegionMetricValue,
  formatMetricValue,
  getCountryMetricValue,
} from "./data-model.js";

const WIDTH = 960;
const HEIGHT = 560;
const SCATTER_X_AXIS = "GDP per Capita";
const SCATTER_Y_AXIS = "ETF Price";
const WORLD_FEATURES = feature(
  worldCountries,
  worldCountries.objects.countries,
).features;

/**
 * Creates the interactive map and returns its update function.
 *
 * @param {HTMLElement} container Element that receives the SVG.
 * @param {object} data Loaded spider data.
 * @param {(iso3: string) => void} onSelectCountry Country click handler.
 * @param {(region: string) => void} onSelectRegion Region click handler.
 * @returns {(options: object) => void} Update function.
 */
export function createIndicatorMap(container, data, onSelectCountry, onSelectRegion) {
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
    .attr("role", "img")
    .attr("aria-label", "Interactive economic indicator map");

  const projection = d3.geoNaturalEarth1().fitExtent(
    [
      [24, 34],
      [WIDTH - 24, HEIGHT - 42],
    ],
    { type: "FeatureCollection", features: WORLD_FEATURES },
  );
  const geoPath = d3.geoPath(projection);
  const countries = getRenderableCountries(data, geoPath);

  const baseLayer = svg.append("g").attr("class", "world-base");
  const mapLayer = svg.append("g").attr("class", "indicator-map");
  const scatterLayer = svg.append("g").attr("class", "scatter-layer");
  const labelLayer = svg.append("g").attr("class", "map-labels");
  const legendLayer = svg.append("g").attr("class", "map-legend");

  renderBaseMap(baseLayer, geoPath);

  /**
   * Updates map/scatter marks for the current indicator and year.
   *
   * @param {object} options Active visualization state.
   */
  function update(options) {
    const values = countries.map((country) => ({
      ...country,
      value: getCountryMetricValue(
        data.countries[country.iso3],
        options.axis,
        options.yearIndex,
        options.valueMode,
      ),
      scatterX: getCountryMetricValue(
        data.countries[country.iso3],
        SCATTER_X_AXIS,
        options.yearIndex,
        "growth",
      ),
      scatterY: getCountryMetricValue(
        data.countries[country.iso3],
        SCATTER_Y_AXIS,
        options.yearIndex,
        "growth",
      ),
    }));
    const maxValue = Math.max(2, d3.max(values, (country) => country.value ?? 0) ?? 2);
    const colorScale = d3
      .scaleSequential(d3.interpolateRgbBasis(["#24324f", "#7fb0ff", "#f9d976"]))
      .domain([0, maxValue]);
    const scatterPoints = buildScatterPoints(data, values, options);
    const scatterScales = getScatterScales(scatterPoints);

    baseLayer.attr("opacity", options.viewMode === "map" ? 1 : 0);
    mapLayer
      .attr("opacity", options.viewMode === "map" ? 1 : 0)
      .attr("pointer-events", options.viewMode === "map" ? "auto" : "none");
    labelLayer.attr("opacity", options.viewMode === "map" ? 1 : 0);
    scatterLayer
      .attr("opacity", options.viewMode === "scatter" ? 1 : 0)
      .attr("pointer-events", options.viewMode === "scatter" ? "auto" : "none");
    renderLegend(legendLayer, data, options.axis, options.valueMode, maxValue);
    renderMap(mapLayer, values, geoPath, colorScale, options, data, onSelectCountry, onSelectRegion);
    renderLabels(labelLayer, values, options);
    renderScatter(
      scatterLayer,
      scatterPoints,
      scatterScales,
      options,
      data,
      onSelectCountry,
      onSelectRegion,
    );
  }

  return update;
}

/**
 * Draws all non-data countries as a quiet basemap.
 *
 * @param {d3.Selection} layer SVG group.
 * @param {d3.GeoPath} geoPath Projected path generator.
 */
function renderBaseMap(layer, geoPath) {
  layer
    .selectAll("path")
    .data(WORLD_FEATURES)
    .join("path")
    .attr("d", geoPath)
    .attr("fill", "#121a29")
    .attr("stroke", "#263347")
    .attr("stroke-width", 0.35);
}

/**
 * Draws the data countries as a choropleth.
 *
 * @param {d3.Selection} layer SVG group.
 * @param {object[]} countries Renderable country objects.
 * @param {d3.GeoPath} geoPath Projected path generator.
 * @param {d3.ScaleSequential} colorScale Indicator color scale.
 * @param {object} options Active state.
 * @param {(iso3: string) => void} onSelectCountry Country click handler.
 * @param {(region: string) => void} onSelectRegion Region click handler.
 */
function renderMap(layer, countries, geoPath, colorScale, options, data, onSelectCountry, onSelectRegion) {
  const paths = layer
    .selectAll("path")
    .data(countries, (country) => country.iso3)
    .join("path")
    .attr("class", "map-country-shape")
    .attr("d", (country) => geoPath(country.feature))
    .attr("fill", (country) =>
      country.value === null ? "#30394c" : colorScale(country.value),
    )
    .attr("stroke", (country) =>
      isSelected(country, options)
        ? "#ffffff"
        : getCountryStroke(country, options),
    )
    .attr("stroke-width", (country) =>
      isSelected(country, options) ? 2.4 : 0.8,
    )
    .on("click", (_, country) => {
      if (options.selectionMode === "regions") onSelectRegion(country.region);
      else onSelectCountry(country.iso3);
    });

  paths.selectAll("title").remove();
  paths
    .append("title")
    .text(
      (country) => {
        const value = formatMetricValue(
          data,
          options.axis,
          country.value,
          options.valueMode,
        );
        return `${country.name}: ${value} (${country.region})`;
      },
    );
}

/**
 * Returns the country outline color for the active selection mode.
 *
 * @param {object} country Renderable country.
 * @param {object} options Active state.
 * @returns {string} Stroke color.
 */
function getCountryStroke(country, options) {
  if (options.selectionMode === "regions") return REGION_COLORS[country.region];
  return country.color;
}

/**
 * Draws labels only for selected countries.
 *
 * @param {d3.Selection} layer SVG group.
 * @param {object[]} countries Renderable country objects.
 * @param {object} options Active state.
 */
function renderLabels(layer, countries, options) {
  layer
    .selectAll("text")
    .data(
      countries.filter((country) => isSelected(country, options)),
      (country) => country.iso3,
    )
    .join("text")
    .attr("x", (country) => country.x)
    .attr("y", (country) => country.y - 6)
    .attr("text-anchor", "middle")
    .text((country) => country.iso3);
}

/**
 * Draws the complementary flag scatter plot.
 *
 * @param {d3.Selection} layer SVG group.
 * @param {object[]} points Renderable scatter point objects.
 * @param {object} scales Scatter scales.
 * @param {object} options Active state.
 * @param {object} data Loaded spider data.
 * @param {(iso3: string) => void} onSelectCountry Country click handler.
 * @param {(region: string) => void} onSelectRegion Region click handler.
 */
function renderScatter(layer, points, scales, options, data, onSelectCountry, onSelectRegion) {
  renderScatterAxes(layer, scales);

  const pointGroups = layer
    .selectAll("g.scatter-point")
    .data(points, (point) => point.id)
    .join("g")
    .attr("class", "scatter-point")
    .attr("transform", (point) => {
      const x = scales.x(point.scatterX ?? 0);
      const y = scales.y(point.scatterY ?? 0);
      return `translate(${x},${y})`;
    })
    .on("click", (_, point) => {
      if (point.kind === "region") onSelectRegion(point.region);
      else onSelectCountry(point.iso3);
    });

  pointGroups
    .selectAll("circle")
    .data((point) => [point])
    .join("circle")
    .attr("r", (point) => (point.kind === "region" ? 26 : 20))
    .attr("fill", (point) => point.color)
    .attr("fill-opacity", 0.28)
    .attr("stroke", (point) =>
      isSelected(point, options) ? "#ffffff" : point.color,
    )
    .attr("stroke-width", (point) =>
      isSelected(point, options) ? 3 : 1.2,
    );

  pointGroups
    .selectAll("text")
    .data((point) => [point])
    .join("text")
    .attr("text-anchor", "middle")
    .attr("dy", 7)
    .text((point) => point.label);

  pointGroups.selectAll("title").remove();
  pointGroups
    .append("title")
    .text((point) => {
      const xValue = formatMetricValue(data, SCATTER_X_AXIS, point.scatterX, "growth");
      const yValue = formatMetricValue(data, SCATTER_Y_AXIS, point.scatterY, "growth");
      return `${point.name}: ${SCATTER_X_AXIS} ${xValue}, ${SCATTER_Y_AXIS} ${yValue}`;
    });
}

/**
 * Builds country-level or region-level scatter points for the active selection mode.
 *
 * @param {object} data Loaded spider data.
 * @param {object[]} countries Renderable countries with metric values.
 * @param {object} options Active state.
 * @returns {object[]} Scatter points.
 */
function buildScatterPoints(data, countries, options) {
  if (options.selectionMode !== "regions") {
    return countries.map((country) => ({
      ...country,
      id: country.iso3,
      kind: "country",
      label: country.flag,
      color: country.color,
    }));
  }

  return REGION_ORDER.map((region) => ({
    id: region,
    kind: "region",
    region,
    name: region,
    label: getRegionLabel(region),
    color: REGION_COLORS[region],
    scatterX: calculateRegionMetricValue(
      data,
      region,
      SCATTER_X_AXIS,
      options.yearIndex,
      "growth",
    ),
    scatterY: calculateRegionMetricValue(
      data,
      region,
      SCATTER_Y_AXIS,
      options.yearIndex,
      "growth",
    ),
  }));
}

/**
 * Converts the TopoJSON world data to the countries available in our dataset.
 *
 * @param {object} data Loaded spider data.
 * @param {d3.GeoPath} geoPath Projected path generator.
 * @returns {object[]} Renderable country objects.
 */
function getRenderableCountries(data, geoPath) {
  return Object.keys(data.countries)
    .map((iso3) => {
      const metadata = COUNTRY_METADATA[iso3];
      const feature = getWorldFeature(iso3);
      if (!metadata || !feature) return null;
      const [x, y] = geoPath.centroid(feature);
      return {
        iso3,
        feature,
        x,
        y,
        name: metadata.shortName,
        region: metadata.region,
        flag: metadata.flag,
        color: COUNTRY_COLORS[iso3],
      };
    })
    .filter((country) => country !== null);
}

/**
 * Finds the world-atlas feature corresponding to one ISO3 country code.
 *
 * @param {string} iso3 ISO-3 country code.
 * @returns {object | undefined} GeoJSON feature if available.
 */
function getWorldFeature(iso3) {
  return WORLD_FEATURES.find((country) => {
    const numericId = String(country.id).padStart(3, "0");
    return WORLD_ATLAS_ID_TO_ISO3[numericId] === iso3;
  });
}

/**
 * Builds scales for the scatter view.
 *
 * @param {object[]} countries Renderable countries.
 * @returns {{ x: d3.ScaleLinear, y: d3.ScaleLinear }} Scatter scales.
 */
function getScatterScales(points) {
  const xMax = Math.max(2, d3.max(points, (point) => point.scatterX ?? 0) ?? 2);
  const yMax = Math.max(2, d3.max(points, (point) => point.scatterY ?? 0) ?? 2);
  return {
    x: d3.scaleLinear().domain([0, xMax]).nice().range([82, WIDTH - 48]),
    y: d3.scaleLinear().domain([0, yMax]).nice().range([HEIGHT - 70, 40]),
  };
}

/**
 * Returns whether a country is selected in country or region mode.
 *
 * @param {object} country Renderable country.
 * @param {object} options Active state.
 * @returns {boolean} Whether the country is selected.
 */
function isSelected(country, options) {
  if (options.selectionMode === "regions") {
    return options.selectedRegions.includes(country.region);
  }
  return options.selectedIso3.includes(country.iso3);
}

/**
 * Returns a compact label for region scatter points.
 *
 * @param {string} region Region name.
 * @returns {string} Two-letter display label.
 */
function getRegionLabel(region) {
  if (region === "Asia-Pacific") return "AP";
  if (region === "North America") return "NA";
  if (region === "Latin America") return "LA";
  return region.slice(0, 2).toUpperCase();
}

/**
 * Draws scatter plot axes.
 *
 * @param {d3.Selection} layer SVG group.
 * @param {object} scales Scatter scales.
 */
function renderScatterAxes(layer, scales) {
  const xAxis = d3.axisBottom(scales.x).ticks(5).tickFormat(formatTick);
  const yAxis = d3.axisLeft(scales.y).ticks(5).tickFormat(formatTick);

  layer
    .selectAll("g.scatter-x")
    .data(["x"])
    .join("g")
    .attr("class", "scatter-axis scatter-x")
    .attr("transform", `translate(0,${HEIGHT - 70})`)
    .call(xAxis);

  layer
    .selectAll("g.scatter-y")
    .data(["y"])
    .join("g")
    .attr("class", "scatter-axis scatter-y")
    .attr("transform", "translate(82,0)")
    .call(yAxis);

  layer
    .selectAll("text.scatter-x-label")
    .data([SCATTER_X_AXIS])
    .join("text")
    .attr("class", "scatter-axis-label scatter-x-label")
    .attr("x", WIDTH - 48)
    .attr("y", HEIGHT - 28)
    .attr("text-anchor", "end")
    .text(`${SCATTER_X_AXIS} growth`);

  layer
    .selectAll("text.scatter-y-label")
    .data([SCATTER_Y_AXIS])
    .join("text")
    .attr("class", "scatter-axis-label scatter-y-label")
    .attr("x", 82)
    .attr("y", 24)
    .text(`${SCATTER_Y_AXIS} growth`);
}

/**
 * Formats tick labels as growth multiples.
 *
 * @param {number} value Tick value.
 * @returns {string} Tick label.
 */
function formatTick(value) {
  return `${Number(value).toFixed(0)}x`;
}

/**
 * Renders a compact color legend.
 *
 * @param {d3.Selection} layer SVG group.
 * @param {object} data Loaded spider data.
 * @param {string} axis Indicator name.
 * @param {"growth" | "absolute"} valueMode Value mode.
 * @param {number} maxValue Maximum current value.
 */
function renderLegend(layer, data, axis, valueMode, maxValue) {
  const stops =
    valueMode === "growth"
      ? [1, Math.max(2, maxValue / 2), maxValue]
      : [0, maxValue / 2, maxValue];
  const colorScale = d3
    .scaleSequential(d3.interpolateRgbBasis(["#24324f", "#7fb0ff", "#f9d976"]))
    .domain([0, maxValue]);

  layer.attr("transform", `translate(${WIDTH - 250},${HEIGHT - 26})`);

  layer
    .selectAll("circle")
    .data(stops)
    .join("circle")
    .attr("cx", (_, index) => index * 78)
    .attr("cy", 0)
    .attr("r", 7)
    .attr("fill", colorScale)
    .attr("stroke", "#ffffff55");

  layer
    .selectAll("text")
    .data(stops)
    .join("text")
    .attr("x", (_, index) => index * 78 + 13)
    .attr("y", 4)
    .attr("fill", "#aab3c5")
    .attr("font-size", 12)
    .text((value) => formatMetricValue(data, axis, value, valueMode));
}
