import * as d3 from "d3";
import { COUNTRY_COLORS, REGION_COLORS } from "./data-model.js";

const SERIES = [
  { id: "us-gdp-current", label: "US GDP (current USD)", source: "custom", color: COUNTRY_COLORS.USA },
  { id: "eu-gdp-current", label: "Europe GDP (current USD)", source: "custom", color: REGION_COLORS.Europe },
  { id: "us-gdp-ppp", label: "US GDP (PPP)", source: "country", key: "USA", metric: "GDP", color: "#ffb0aa", dash: "6 4" },
  { id: "eu-gdp-ppp", label: "Europe GDP (PPP)", source: "region", key: "Europe", metric: "GDP", color: "#9bd2ff", dash: "6 4" },
  { id: "us-etf", label: "US ETF", source: "country", key: "USA", metric: "ETF Price", color: "#ffcf9f" },
  { id: "eu-etf", label: "Europe ETF", source: "region", key: "Europe", metric: "ETF Price", color: "#8bd7ff" },
  { id: "us-market-cap", label: "US Market Cap", source: "country", key: "USA", metric: "Market Cap", color: "#ff8f86" },
  { id: "eu-market-cap", label: "Europe Market Cap", source: "region", key: "Europe", metric: "Market Cap", color: "#66bdf2" },
];

const DEFAULT_SELECTED = new Set([
  "us-gdp-current",
  "eu-gdp-current",
  "us-gdp-ppp",
  "eu-gdp-ppp",
]);

const QUICK_SELECTS = [
  {
    id: "gdp",
    label: "GDP lenses",
    series: ["us-gdp-current", "eu-gdp-current", "us-gdp-ppp", "eu-gdp-ppp"],
  },
  {
    id: "etf",
    label: "ETF only",
    series: ["us-etf", "eu-etf"],
  },
  {
    id: "market-cap",
    label: "Market cap only",
    series: ["us-market-cap", "eu-market-cap"],
  },
];

export function createNormalizationExplorer(container, data) {
  if (!container) return null;

  let baseYear = 2008;
  let selected = new Set(DEFAULT_SELECTED);
  let realAdjustedSeries = {};
  let unitNote = "";

  container.innerHTML = `
    <div class="normalization-explorer__story">
      <p>Hover over a line to see details.</p>
      <p>
        Normalized to <button type="button" class="normalization-year-jump" data-year="2000">2000</button>,
        US and European GDP both grow before the crisis, but current-dollar GDP already embeds exchange-rate and price-level swings.
        Normalized to <button type="button" class="normalization-year-jump" data-year="2008">2008</button>,
        current-USD GDP shows a sharp US/Europe divergence around the crisis.
        Normalized to <button type="button" class="normalization-year-jump" data-year="2010">2010</button>,
        the PPP-adjusted view makes the split milder and later: Europe still trails, but less like a sudden collapse and more like slower post-crisis compounding.
      </p>
      <div class="normalization-quick-select" id="normalization-quick-select" aria-label="Quick series selection"></div>
    </div>
    <div class="normalization-explorer__controls">
      <label class="control-field normalization-explorer__slider">
        <span class="control-label">
          Normalization year <span class="control-value" id="normalization-year-label">${baseYear}</span>
        </span>
        <input id="normalization-year-slider" type="range" min="${data.baselineYear}" max="${data.latestYear}" value="${baseYear}" step="1" />
      </label>
      <div class="normalization-explorer__series" id="normalization-series"></div>
    </div>
    <div class="analysis-chart normalization-explorer__chart" id="normalization-chart"></div>
    <p class="normalization-explorer__note" id="normalization-unit-note"></p>
  `;

  const yearLabel = container.querySelector("#normalization-year-label");
  const slider = container.querySelector("#normalization-year-slider");
  const quickSelectContainer = container.querySelector("#normalization-quick-select");
  const seriesContainer = container.querySelector("#normalization-series");
  const chartContainer = container.querySelector("#normalization-chart");
  const unitNoteElement = container.querySelector("#normalization-unit-note");
  const seriesButtons = new Map();

  QUICK_SELECTS.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "normalization-quick-button";
    button.dataset.presetId = preset.id;
    button.textContent = preset.label;
    button.addEventListener("click", () => {
      selected = new Set(preset.series);
      syncSeriesButtons();
      syncQuickButtons();
      render();
    });
    quickSelectContainer.append(button);
  });

  SERIES.forEach((series) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "normalization-series-button";
    button.dataset.seriesId = series.id;
    button.dataset.active = String(selected.has(series.id));
    button.innerHTML = `<span style="--series-color: ${series.color}"></span>${series.label}`;
    button.addEventListener("click", () => {
      if (selected.has(series.id)) {
        if (selected.size === 1) return;
        selected.delete(series.id);
      } else {
        selected.add(series.id);
      }
      button.dataset.active = String(selected.has(series.id));
      syncQuickButtons();
      render();
    });
    seriesButtons.set(series.id, button);
    seriesContainer.append(button);
  });
  syncQuickButtons();

  slider.addEventListener("input", () => {
    baseYear = Number.parseInt(slider.value, 10);
    yearLabel.textContent = String(baseYear);
    updateRangeProgress(slider);
    render();
  });
  updateRangeProgress(slider);
  d3.json("./analysis_lab_data.json").then((analysis) => {
    realAdjustedSeries = analysis?.realAdjustedExplorer?.series ?? {};
    unitNote = analysis?.realAdjustedExplorer?.unitNote ?? "";
    render();
  });

  container.querySelectorAll(".normalization-year-jump").forEach((button) => {
    button.addEventListener("click", () => {
      baseYear = Number.parseInt(button.dataset.year, 10);
      slider.value = String(baseYear);
      yearLabel.textContent = String(baseYear);
      updateRangeProgress(slider);
      render();
    });
  });

  render();

  function render() {
    chartContainer.textContent = "";
    const selectedSeries = SERIES.filter((series) => selected.has(series.id))
      .map((series) => ({
        ...series,
        values: normalizeSeries(getDisplayValues(data, series, realAdjustedSeries), data.years, baseYear),
        method: realAdjustedSeries[series.id]?.method,
      }))
      .filter((series) => series.values.some((value) => value !== null));

    drawExplorerChart(chartContainer, data.years, selectedSeries, baseYear);
    if (unitNoteElement) {
      unitNoteElement.textContent = unitNote || "Using the shared project preprocessing output for all selected series.";
    }
  }

  return { render };

  function syncSeriesButtons() {
    seriesButtons.forEach((button, seriesId) => {
      button.dataset.active = String(selected.has(seriesId));
    });
  }

  function syncQuickButtons() {
    quickSelectContainer.querySelectorAll(".normalization-quick-button").forEach((button) => {
      const preset = QUICK_SELECTS.find((entry) => entry.id === button.dataset.presetId);
      const active = preset?.series.length === selected.size && preset.series.every((seriesId) => selected.has(seriesId));
      button.dataset.active = String(Boolean(active));
    });
  }
}

function drawExplorerChart(container, years, series, baseYear) {
  const width = 980;
  const height = 420;
  const margin = { top: 24, right: 180, bottom: 46, left: 58 };
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", `Selected series normalized to ${baseYear} = 1`);
  const x = d3.scaleLinear().domain([years[0], years.at(-1)]).range([margin.left, width - margin.right]);
  const maxValue = d3.max(series.flatMap((entry) => entry.values), (value) => value ?? 0) ?? 1;
  const minValue = d3.min(series.flatMap((entry) => entry.values), (value) => value ?? 1) ?? 1;
  const y = d3
    .scaleLinear()
    .domain([Math.max(0, minValue * 0.88), Math.max(1.25, maxValue * 1.08)])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const line = d3
    .line()
    .defined((point) => point.value !== null)
    .x((point) => x(point.year))
    .y((point) => y(point.value));
  const lineRows = series.map((entry) => ({
    ...entry,
    points: years.map((year, index) => ({ year, value: entry.values[index], series: entry })),
  }));

  svg
    .append("g")
    .attr("class", "analysis-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues([2000, 2004, 2008, 2012, 2016, 2020, 2023]).tickFormat(String));

  svg
    .append("g")
    .attr("class", "analysis-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickFormat((value) => `${value.toFixed(1)}x`));

  svg
    .append("line")
    .attr("class", "analysis-baseline-line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", y(1))
    .attr("y2", y(1));

  svg
    .append("line")
    .attr("class", "normalization-base-line")
    .attr("x1", x(baseYear))
    .attr("x2", x(baseYear))
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom);

  svg
    .append("text")
    .attr("class", "analysis-break-label")
    .attr("x", x(baseYear) + 8)
    .attr("y", margin.top + 14)
    .text(`${baseYear} = 1x`);

  svg
    .append("g")
    .selectAll("path")
    .data(lineRows)
    .join("path")
    .attr("class", "analysis-line normalization-line")
    .attr("fill", "none")
    .attr("stroke", (entry) => entry.color)
    .attr("stroke-width", 2.8)
    .attr("stroke-dasharray", (entry) => entry.dash ?? null)
    .attr("d", (entry) => line(entry.points));

  svg
    .append("g")
    .selectAll("circle")
    .data(series)
    .join("circle")
    .attr("class", "normalization-base-marker")
    .attr("cx", x(baseYear))
    .attr("cy", y(1))
    .attr("r", 4.5)
    .attr("fill", (entry) => entry.color);

  const legend = svg
    .append("g")
    .attr("class", "analysis-legend normalization-legend")
    .attr("transform", `translate(${width - margin.right + 20},${margin.top})`);
  const rows = legend
    .selectAll("g")
    .data(series)
    .join("g")
    .attr("transform", (_, index) => `translate(0, ${index * 20})`);

  rows
    .append("rect")
    .attr("width", 10)
    .attr("height", 10)
    .attr("rx", 2)
    .attr("fill", (entry) => (entry.dash ? "transparent" : entry.color))
    .attr("stroke", (entry) => entry.color)
    .attr("stroke-width", (entry) => (entry.dash ? 2 : 0));
  rows.append("text").attr("x", 16).attr("y", 9).text((entry) => entry.label);

  const hover = svg.append("g").attr("class", "normalization-hover-callout").style("display", "none");
  hover.append("circle").attr("class", "normalization-hover-marker").attr("r", 5.5);
  hover.append("text").attr("class", "normalization-hover-label").attr("x", 10).attr("y", -10);

  svg
    .append("rect")
    .attr("class", "normalization-hover-layer")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", width - margin.left - margin.right)
    .attr("height", height - margin.top - margin.bottom)
    .on("mousemove", (event) => {
      const [mouseX, mouseY] = d3.pointer(event);
      const target = nearestPoint(lineRows, years, x, y, mouseX, mouseY);
      if (!target) return;
      svg
        .selectAll(".normalization-line")
        .classed("normalization-line--dimmed", (entry) => entry.id !== target.series.id)
        .classed("normalization-line--active", (entry) => entry.id === target.series.id);
      const pointX = x(target.point.year);
      const pointY = y(target.point.value);
      const textX = Math.min(pointX + 12, width - margin.right - 112);
      const textY = Math.max(margin.top + 18, pointY - 12);
      hover
        .style("display", null)
        .attr("transform", `translate(${pointX},${pointY})`)
        .select("circle")
        .attr("fill", target.series.color);
      hover
        .select("text")
        .attr("x", textX - pointX)
        .attr("y", textY - pointY)
        .call((text) => {
          text.text("");
          text.append("tspan").attr("x", textX - pointX).attr("dy", 0).text(target.series.label);
          text.append("tspan").attr("x", textX - pointX).attr("dy", 15).text(`${target.point.year}: ${target.point.value.toFixed(2)}x ${baseYear}`);
        });
    })
    .on("mouseleave", () => {
      svg.selectAll(".normalization-line").classed("normalization-line--dimmed", false).classed("normalization-line--active", false);
      hover.style("display", "none");
    });
}

function nearestPoint(lineRows, years, x, y, mouseX, mouseY) {
  const year = Math.round(x.invert(mouseX));
  const index = Math.max(0, Math.min(years.length - 1, d3.bisectCenter(years, year)));
  let best = null;
  lineRows.forEach((series) => {
    const point = series.points[index];
    if (!point || point.value === null) return;
    const distance = Math.abs(y(point.value) - mouseY);
    if (!best || distance < best.distance) best = { series, point, distance };
  });
  return best;
}

function getSeriesValues(data, series) {
  if (series.source === "custom") return [];
  if (series.source === "country") {
    return data.countries[series.key]?.timeseries?.[series.metric]?.normalized ?? [];
  }
  return data.regionsData[series.key]?.timeseries?.[series.metric]?.normalized ?? [];
}

function getDisplayValues(data, series, realAdjustedSeries) {
  return realAdjustedSeries[series.id]?.values ?? getSeriesValues(data, series);
}

function normalizeSeries(values, years, baseYear) {
  const baseIndex = years.indexOf(baseYear);
  const baseValue = values[baseIndex];
  if (baseIndex < 0 || baseValue === null || baseValue <= 0) {
    return values.map(() => null);
  }
  return values.map((value) => (value === null ? null : value / baseValue));
}

function updateRangeProgress(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value || 0);
  const percent = ((value - min) / (max - min)) * 100;
  input.style.setProperty("--range-progress", `${percent}%`);
}
