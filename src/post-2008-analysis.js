import * as d3 from "d3";
import { COUNTRY_COLORS, REGION_COLORS } from "./data-model.js";

const MARKET_PROFILES = [
  { id: "Europe ETF", label: "Europe ETF", color: REGION_COLORS.Europe, values: (data) => getRegionSeries(data, "Europe", "ETF Price") },
  { id: "Europe Market Cap", label: "Europe Market Cap", color: `${REGION_COLORS.Europe}aa`, values: (data) => getRegionSeries(data, "Europe", "Market Cap") },
  { id: "US ETF", label: "US ETF", color: COUNTRY_COLORS.USA, values: (data) => getCountrySeries(data, "USA", "ETF Price") },
  { id: "US Market Cap", label: "US Market Cap", color: `${COUNTRY_COLORS.USA}aa`, values: (data) => getCountrySeries(data, "USA", "Market Cap") },
];
const FUNDAMENTAL_PROFILES = [
  { id: "Europe GDP", label: "Europe GDP", color: "#7dc4ff", values: (data) => getRegionSeries(data, "Europe", "GDP") },
  { id: "Europe GDP per Capita", label: "Europe GDP / capita", color: "#a2f0c0", values: (data) => getRegionSeries(data, "Europe", "GDP per Capita") },
  { id: "Europe ETF", label: "Europe ETF", color: "#f7c66b", values: (data) => getRegionSeries(data, "Europe", "ETF Price") },
  { id: "US GDP per Capita", label: "US GDP / capita", color: "#ff9f9a", values: (data) => getCountrySeries(data, "USA", "GDP per Capita") },
];
const DISTRIBUTION_COMPARISON = [
  {
    id: "USA",
    label: "United States",
    value: 24.0,
    color: COUNTRY_COLORS.USA,
  },
  {
    id: "EA",
    label: "Euro area",
    value: 4.2,
    color: REGION_COLORS.Europe,
  },
];

export function renderPost2008Analysis(data) {
  renderMarketChart(data, getRequiredElement("analysis-market-chart"));
  renderFundamentalsChart(data, getRequiredElement("analysis-fundamentals-chart"));
  renderDistributionChart(getRequiredElement("analysis-distribution-chart"));
}

/**
 * Renders the focused 2008 divergence chart used in the final guided story.
 *
 * @param {object} data Loaded spider data.
 * @param {HTMLElement} container Chart container.
 * @param {HTMLElement | null} noteElement Optional explanatory note target.
 */
export function renderMarketDivergenceAnalysis(data, container, noteElement = null) {
  renderMarketChart(data, container, noteElement);
}

/**
 * Renders candidate break-year BIC score histograms around the 2008 crisis.
 *
 * @param {object[]} rows Break-finder rows from analysis_lab_data.json.
 * @param {HTMLElement} container Chart container.
 */
export function renderBreakFinderAnalysis(rows, container) {
  const selectedRows = rows;
  const wrap = d3.select(container);
  wrap.selectAll("*").remove();
  wrap
    .append("p")
    .attr("class", "story-methodology")
    .text("Candidate break years from 2005-2015. Height shows relative BIC score for a piecewise US/Europe gap model; 1 is the best candidate for that metric.");

  selectedRows.forEach((row) => {
    const item = wrap.append("div").attr("class", "story-break");
    item.append("span").attr("class", "story-break__metric").text(row.metric);
    item.append("strong").text(row.bestYear);
    const scores = item.append("div").attr("class", "story-break__scores");
    scores
      .selectAll("span")
      .data(row.scores)
      .join("span")
      .style("--score", (score) => score.score)
      .attr("title", (score) => `${score.year}: ${score.score.toFixed(2)}`)
      .attr("data-best", (score) => score.year === row.bestYear)
      .attr("data-crisis", (score) => score.year === 2008);
    item
      .append("span")
      .attr("class", "story-break__axis-note")
      .text("2005 -> 2015, highlighted bar = best fit; 2008 is marked where relevant.");
  });
}

function renderMarketChart(data, container, noteElement = getRequiredElement("analysis-market-note")) {
  renderIndexedLineChart(
    container,
    "Markets indexed to 2008 = 1",
    data.years,
    MARKET_PROFILES.map((profile) => ({
      id: profile.id,
      label: profile.label,
      color: profile.color,
      values: normalizeToYear(profile.values(data), data.years, 2008),
    })),
  );

  if (noteElement) noteElement.textContent =
    "All lines rebased to 2008 = 1 on the same real/PPP preprocessing basis. The ETF split remains the clearest divergence: US rebounds strongly, Europe stays below its 2008 level.";
}

function renderFundamentalsChart(data, container) {
  renderIndexedLineChart(
    container,
    "Fundamentals and markets indexed to 2008 = 1",
    data.years,
    FUNDAMENTAL_PROFILES.map((profile) => ({
      id: profile.id,
      label: profile.label,
      color: profile.color,
      values: normalizeToYear(profile.values(data), data.years, 2008),
    })),
  );

  getRequiredElement("analysis-fundamentals-note").textContent =
    "Same rebase, different story: Europe real GDP and GDP/cap still rise after 2008, but slower than the US. The market-proxy gap is much larger than the output gap.";
}

function renderDistributionChart(container) {
  const svg = baseSvg(
    container,
    560,
    250,
    "Average annual capital gains on household financial assets relative to disposable income",
  );
  const width = 560;
  const height = 250;
  const margin = { top: 18, right: 20, bottom: 42, left: 64 };
  const x = d3
    .scaleLinear()
    .domain([0, 26])
    .range([margin.left, width - margin.right]);
  const y = d3
    .scaleBand()
    .domain(DISTRIBUTION_COMPARISON.map((d) => d.label))
    .range([margin.top, height - margin.bottom])
    .padding(0.34);

  svg
    .append("g")
    .attr("class", "analysis-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat((value) => `${value}%`));

  svg
    .append("g")
    .attr("class", "analysis-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg
    .append("g")
    .selectAll("rect")
    .data(DISTRIBUTION_COMPARISON)
    .join("rect")
    .attr("class", "analysis-bar")
    .attr("x", margin.left)
    .attr("y", (d) => y(d.label))
    .attr("width", (d) => x(d.value) - margin.left)
    .attr("height", y.bandwidth())
    .attr("rx", 8)
    .attr("fill", (d) => d.color);

  svg
    .append("g")
    .selectAll("text")
    .data(DISTRIBUTION_COMPARISON)
    .join("text")
    .attr("class", "analysis-value-label")
    .attr("x", (d) => x(d.value) + 8)
    .attr("y", (d) => y(d.label) + y.bandwidth() / 2 + 4)
    .text((d) => `${d.value.toFixed(1)}%`);
}

function renderIndexedLineChart(container, label, years, series) {
  const svg = baseSvg(container, 560, 250, label);
  const width = 560;
  const height = 250;
  const margin = { top: 16, right: 18, bottom: 40, left: 52 };
  const x = d3.scaleLinear().domain([years[0], years[years.length - 1]]).range([margin.left, width - margin.right]);
  const maxValue =
    d3.max(series.flatMap((entry) => entry.values), (value) => value ?? 0) ?? 1.5;
  const y = d3.scaleLinear().domain([0.6, Math.max(1.6, maxValue)]).nice().range([height - margin.bottom, margin.top]);
  const line = d3
    .line()
    .defined((point) => point.value !== null)
    .x((point) => x(point.year))
    .y((point) => y(point.value));

  svg
    .append("g")
    .attr("class", "analysis-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues([2000, 2004, 2008, 2012, 2016, 2020, 2023]).tickFormat((value) => String(value)));

  svg
    .append("g")
    .attr("class", "analysis-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value.toFixed(1)}x`));

  svg
    .append("line")
    .attr("class", "analysis-baseline-line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", y(1))
    .attr("y2", y(1));

  svg
    .append("line")
    .attr("class", "analysis-break-line")
    .attr("x1", x(2008))
    .attr("x2", x(2008))
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom);

  svg
    .append("text")
    .attr("class", "analysis-break-label")
    .attr("x", x(2008) + 6)
    .attr("y", margin.top + 12)
    .text("2008");

  svg
    .append("g")
    .selectAll("path")
    .data(series)
    .join("path")
    .attr("class", "analysis-line")
    .attr("fill", "none")
    .attr("stroke", (d) => d.color)
    .attr("stroke-width", 2.6)
    .attr("d", (d) =>
      line(years.map((year, index) => ({ year, value: d.values[index] }))),
    );

  renderLegend(svg, width - margin.right - 170, 20, series.map((entry) => ({
    label: entry.label,
    color: entry.color,
  })));
}

function renderLegend(svg, x, y, items) {
  const legend = svg.append("g").attr("class", "analysis-legend").attr("transform", `translate(${x},${y})`);
  const rows = legend
    .selectAll("g")
    .data(items)
    .join("g")
    .attr("transform", (_, index) => `translate(0, ${index * 18})`);

  rows
    .append("rect")
    .attr("width", 10)
    .attr("height", 10)
    .attr("rx", 2)
    .attr("fill", (d) => d.color);

  rows
    .append("text")
    .attr("x", 16)
    .attr("y", 9)
    .text((d) => d.label);
}

function baseSvg(container, width, height, label) {
  return d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", label);
}

function getRegionSeries(data, region, metric) {
  return data.regionsData[region]?.timeseries?.[metric]?.normalized ?? [];
}

function getCountrySeries(data, iso3, metric) {
  return data.countries[iso3]?.timeseries?.[metric]?.normalized ?? [];
}

function normalizeToYear(values, years, baseYear) {
  const baseIndex = years.indexOf(baseYear);
  const baseValue = values[baseIndex];
  if (baseIndex < 0 || baseValue === null || baseValue <= 0) {
    return values.map(() => null);
  }
  return values.map((value) =>
    value === null ? null : value / baseValue,
  );
}

function getRequiredElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}
