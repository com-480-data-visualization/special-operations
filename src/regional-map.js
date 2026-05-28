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
const SCATTER_PLOT_BOUNDS = {
  left: 82,
  right: WIDTH - 48,
  top: 40,
  bottom: HEIGHT - 70,
};
const TOOLTIP_AXIS_ORDER = ["GDP", "GDP per Capita", "ETF Price", "Market Cap"];
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

  const viewportLayer = svg.append("g").attr("class", "map-viewport-layer");
  const baseLayer = viewportLayer.append("g").attr("class", "world-base");
  const mapLayer = viewportLayer.append("g").attr("class", "indicator-map");
  const scatterLayer = svg.append("g").attr("class", "scatter-layer");
  const labelLayer = viewportLayer.append("g").attr("class", "map-labels");
  const legendLayer = svg.append("g").attr("class", "map-legend");
  const tooltip = d3.select(container).append("div").attr("class", "map-tooltip").attr("hidden", true);

  renderBaseMap(baseLayer, geoPath);

  /**
   * Updates map/scatter marks for the current indicator and year.
   *
   * @param {object} options Active visualization state.
   */
  function update(options) {
    const values = countries.map((country) => ({
      ...country,
      value:
        options.selectionMode === "regions"
          ? calculateRegionMetricValue(
              data,
              country.region,
              options.axis,
              options.yearIndex,
              options.valueMode,
            )
          : getCountryMetricValue(
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
    const finiteValues = values
      .map((country) => country.value)
      .filter((value) => Number.isFinite(value));
    const colorScale = createMetricColorScale(finiteValues, options.valueMode);
    const scatterPoints = buildScatterPoints(data, values, options);
    const scatterScales = getScatterScales(scatterPoints);

    baseLayer.attr("opacity", options.viewMode === "map" ? 1 : 0);
    mapLayer
      .attr("opacity", options.viewMode === "map" ? 1 : 0)
      .attr("pointer-events", options.viewMode === "map" ? "auto" : "none");
    labelLayer.attr("opacity", options.viewMode === "map" ? 1 : 0);
    applyMapFocus(viewportLayer, options.mapFocus, options.viewMode);
    scatterLayer
      .attr("opacity", options.viewMode === "scatter" ? 1 : 0)
      .attr("pointer-events", options.viewMode === "scatter" ? "auto" : "none");
    renderLegend(legendLayer, data, options.axis, options.valueMode, finiteValues);
    renderMap(mapLayer, values, geoPath, colorScale, options, data, onSelectCountry, onSelectRegion, tooltip, container);
    renderLabels(labelLayer, values, options, data);
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
    .attr("fill", "#1c2738")
    .attr("stroke", "#3a4860")
    .attr("stroke-width", 0.45);
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
 * @param {d3.Selection} tooltip Country tooltip element.
 * @param {HTMLElement} container Chart container.
 */
function renderMap(
  layer,
  countries,
  geoPath,
  colorScale,
  options,
  data,
  onSelectCountry,
  onSelectRegion,
  tooltip,
  container,
) {
  const paths = layer
    .selectAll("path")
    .data(countries, (country) => country.iso3)
    .join("path")
    .attr("class", "map-country-shape")
    .attr("d", (country) => geoPath(country.feature))
    .attr("fill", (country) =>
      country.value === null ? "#485468" : colorScale(country.value),
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
    })
    .on("mouseenter", (event, country) => {
      showCountryTooltip(tooltip, event, country, data, options, container);
    })
    .on("mousemove", (event) => {
      positionTooltip(tooltip, event, container);
    })
    .on("mouseleave", () => {
      tooltip.attr("hidden", true);
    });

  paths.selectAll("title").remove();
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
 * Shows country metrics with the active map metric first.
 *
 * @param {d3.Selection} tooltip Tooltip element.
 * @param {PointerEvent} event Pointer event.
 * @param {object} country Renderable country object.
 * @param {object} data Loaded spider data.
 * @param {object} options Active state.
 * @param {HTMLElement} container Chart container.
 */
function showCountryTooltip(tooltip, event, country, data, options, container) {
  const countryData = data.countries[country.iso3];
  if (!countryData) return;

  const axes = [
    options.axis,
    ...TOOLTIP_AXIS_ORDER.filter((axis) => axis !== options.axis && data.axes.includes(axis)),
  ];
  const rows = axes.map((axis) => ({
    axis,
    value: formatMetricValue(
      data,
      axis,
      getCountryMetricValue(countryData, axis, options.yearIndex, options.valueMode),
      options.valueMode,
    ),
  }));

  tooltip
    .attr("hidden", null)
    .html(
      `<p class="map-tooltip__kicker">${country.region}</p>
       <h3>${country.name}</h3>
       <p class="map-tooltip__mode">${options.valueMode === "growth" ? "Compounded since 2000" : "Absolute value"} · ${data.years[options.yearIndex]}</p>
       <dl>
         ${rows.map((row) => `<div><dt>${row.axis}</dt><dd>${row.value}</dd></div>`).join("")}
       </dl>`,
    );
  positionTooltip(tooltip, event, container);
}

/**
 * Positions the HTML country tooltip inside the chart bounds.
 *
 * @param {d3.Selection} tooltip Tooltip element.
 * @param {PointerEvent} event Pointer event.
 * @param {HTMLElement} container Chart container.
 */
function positionTooltip(tooltip, event, container) {
  const [x, y] = d3.pointer(event, container);
  const node = tooltip.node();
  const width = node?.offsetWidth ?? 260;
  const height = node?.offsetHeight ?? 220;
  const left = Math.min(Math.max(12, x + 18), Math.max(12, container.clientWidth - width - 12));
  const top = Math.min(Math.max(12, y + 18), Math.max(12, container.clientHeight - height - 12));
  tooltip.style("left", `${left}px`).style("top", `${top}px`);
}

/**
 * Draws labels only for selected countries.
 *
 * @param {d3.Selection} layer SVG group.
 * @param {object[]} countries Renderable country objects.
 * @param {object} options Active state.
 * @param {object} data Loaded spider data.
 */
function renderLabels(layer, countries, options, data) {
  if (options.selectionMode === "regions") {
    renderRegionLabels(layer, countries, options, data);
    return;
  }

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
 * Draws one aggregate label per selected region in region mode.
 *
 * @param {d3.Selection} layer SVG group.
 * @param {object[]} countries Renderable country objects.
 * @param {object} options Active state.
 * @param {object} data Loaded spider data.
 */
function renderRegionLabels(layer, countries, options, data) {
  const labels = options.selectedRegions
    .map((region) => {
      const regionCountries = countries.filter((country) => country.region === region);
      if (!regionCountries.length) return null;
      const x = d3.mean(regionCountries, (country) => country.x);
      const y = d3.mean(regionCountries, (country) => country.y);
      const value = calculateRegionMetricValue(
        data,
        region,
        options.axis,
        options.yearIndex,
        options.valueMode,
      );
      return { region, x, y, value };
    })
    .filter((label) => label !== null);

  layer
    .selectAll("text")
    .data(labels, (label) => label.region)
    .join("text")
    .attr("x", (label) => label.x)
    .attr("y", (label) => label.y - 8)
    .attr("text-anchor", "middle")
    .text(
      (label) =>
        `${getRegionLabel(label.region)} ${formatMetricValue(
          data,
          options.axis,
          label.value,
          options.valueMode,
        )}`,
    );
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
    x: d3
      .scaleLinear()
      .domain([0, xMax])
      .nice()
      .range([SCATTER_PLOT_BOUNDS.left, SCATTER_PLOT_BOUNDS.right]),
    y: d3
      .scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([SCATTER_PLOT_BOUNDS.bottom, SCATTER_PLOT_BOUNDS.top]),
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
 * Zooms the map viewport for story beats that focus on specific geographies.
 *
 * @param {d3.Selection} layer Group containing basemap, countries, and labels.
 * @param {"world" | "north-atlantic" | undefined} focus Map focus preset.
 * @param {"map" | "scatter"} viewMode Active view mode.
 */
function applyMapFocus(layer, focus, viewMode) {
  const transform =
    viewMode === "map" && focus === "north-atlantic"
      ? "translate(-330,-120) scale(1.9)"
      : "translate(0,0) scale(1)";

  layer
    .transition()
    .duration(520)
    .ease(d3.easeCubicOut)
    .attr("transform", transform);
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
  const xLabelX =
    SCATTER_PLOT_BOUNDS.left +
    (SCATTER_PLOT_BOUNDS.right - SCATTER_PLOT_BOUNDS.left) / 2;
  const yLabelY =
    SCATTER_PLOT_BOUNDS.top +
    (SCATTER_PLOT_BOUNDS.bottom - SCATTER_PLOT_BOUNDS.top) / 2;
  const yLabelX = SCATTER_PLOT_BOUNDS.left - 58;

  layer
    .selectAll("g.scatter-x")
    .data(["x"])
    .join("g")
    .attr("class", "scatter-axis scatter-x")
    .attr("transform", `translate(0,${SCATTER_PLOT_BOUNDS.bottom})`)
    .call(xAxis);

  layer
    .selectAll("g.scatter-y")
    .data(["y"])
    .join("g")
    .attr("class", "scatter-axis scatter-y")
    .attr("transform", `translate(${SCATTER_PLOT_BOUNDS.left},0)`)
    .call(yAxis);

  layer
    .selectAll("text.scatter-x-label")
    .data([SCATTER_X_AXIS])
    .join("text")
    .attr("class", "scatter-axis-label scatter-x-label")
    .attr("x", xLabelX)
    .attr("y", SCATTER_PLOT_BOUNDS.bottom + 42)
    .attr("text-anchor", "middle")
    .text(`${SCATTER_X_AXIS} compounded since 2000`);

  layer
    .selectAll("text.scatter-y-label")
    .data([SCATTER_Y_AXIS])
    .join("text")
    .attr("class", "scatter-axis-label scatter-y-label")
    .attr("x", yLabelX)
    .attr("y", yLabelY)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("transform", `rotate(-90,${yLabelX},${yLabelY})`)
    .text(`${SCATTER_Y_AXIS} compounded since 2000`);
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
 * Creates a color scale from the actual values visible on the map.
 *
 * @param {number[]} values Visible numeric values.
 * @param {"growth" | "absolute"} valueMode Value mode.
 * @returns {(value: number) => string} Color scale.
 */
function createMetricColorScale(values, valueMode) {
  const maxValue = d3.max(values) ?? 1;
  if (valueMode !== "growth") {
    return d3
      .scaleSequential(d3.interpolateRgbBasis(["#24324f", "#7fb0ff", "#f9d976"]))
      .domain([0, maxValue || 1]);
  }

  const minValue = d3.min(values) ?? 1;
  const lowerBound = Math.min(1, minValue);
  const upperBound = Math.max(1.01, maxValue);
  if (lowerBound < 1) {
    return d3
      .scaleLinear()
      .domain([lowerBound, 1, upperBound])
      .range(["#59657c", "#8fb8ff", "#f9d976"])
      .clamp(true);
  }

  return d3
    .scaleLinear()
    .domain([1, upperBound])
    .range(["#8fb8ff", "#f9d976"])
    .clamp(true);
}

/**
 * Renders a compact color legend.
 *
 * @param {d3.Selection} layer SVG group.
 * @param {object} data Loaded spider data.
 * @param {string} axis Indicator name.
 * @param {"growth" | "absolute"} valueMode Value mode.
 * @param {number[]} values Visible numeric values.
 */
function renderLegend(layer, data, axis, valueMode, values) {
  const maxValue = d3.max(values) ?? 1;
  const minValue = d3.min(values) ?? 1;
  const stops =
    valueMode === "growth"
      ? getCompoundedLegendStops(minValue, maxValue)
      : [0, maxValue / 2, maxValue];
  const colorScale = createMetricColorScale(values, valueMode);

  layer.attr("transform", `translate(${WIDTH - 250},${HEIGHT - 26})`);

  layer
    .selectAll("text.legend-title")
    .data([valueMode === "growth" ? "Compounded since 2000" : "Absolute value"])
    .join("text")
    .attr("class", "legend-title")
    .attr("x", 0)
    .attr("y", -18)
    .attr("fill", "#aab3c5")
    .attr("font-size", 11)
    .attr("font-weight", 800)
    .attr("letter-spacing", "0.08em")
    .text((label) => label.toUpperCase());

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
    .selectAll("text.legend-value")
    .data(stops)
    .join("text")
    .attr("class", "legend-value")
    .attr("x", (_, index) => index * 78 + 13)
    .attr("y", 4)
    .attr("fill", "#aab3c5")
    .attr("font-size", 12)
    .text((value) => formatMetricValue(data, axis, value, valueMode));
}

/**
 * Builds readable compounded legend stops around the 1.00x baseline.
 *
 * @param {number} minValue Minimum visible value.
 * @param {number} maxValue Maximum visible value.
 * @returns {number[]} Legend stop values.
 */
function getCompoundedLegendStops(minValue, maxValue) {
  const lowerBound = Math.min(1, minValue);
  const upperBound = Math.max(1.01, maxValue);
  const midpoint = lowerBound + (upperBound - lowerBound) / 2;
  return [lowerBound, midpoint, upperBound];
}
