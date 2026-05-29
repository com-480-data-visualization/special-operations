import * as d3 from "d3";

const CHART_SERIES = [
  {
    id: "ecb-total-financial-assets",
    color: "#f7c66b",
  },
  {
    id: "ecb-net-worth-income-ratio",
    color: "#7dc4ff",
  },
];

const BREAK_PERIOD = "2008-Q4";

export async function renderEcbHouseholdAnalysis() {
  const container = document.getElementById("analysis-ecb-chart");
  if (!container) return;
  container.textContent = "";

  const data = await d3.json("./ecb_household_assets.json");
  if (!data) return;

  const note = document.getElementById("analysis-ecb-note");
  if (note) {
    note.textContent =
      "ECB quarterly balance-sheet series are rebased to 2008-Q4 = 1. This panel is kept separate from the core market/fundamentals read: it expands the distribution question without changing the base narrative.";
  }

  const series = CHART_SERIES.map((config) => {
    const raw = data.series.find((entry) => entry.id === config.id);
    if (!raw) return null;
    const values = normalizeSeries(raw.points, BREAK_PERIOD);
    return {
      id: raw.id,
      label: raw.label,
      color: config.color,
      values,
    };
  }).filter(Boolean);

  if (!series.length) return;

  renderLineChart(container, series);
}

function renderLineChart(container, series) {
  const width = 720;
  const height = 280;
  const margin = { top: 20, right: 24, bottom: 42, left: 56 };
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "ECB euro-area household balance-sheet series indexed to 2008 Q4");

  const allPoints = series.flatMap((entry) => entry.values).filter((point) => point.value !== null);
  const x = d3
    .scaleLinear()
    .domain(d3.extent(allPoints, (point) => point.yearDecimal))
    .range([margin.left, width - margin.right]);
  const y = d3
    .scaleLinear()
    .domain([
      d3.min(allPoints, (point) => point.value) * 0.96,
      d3.max(allPoints, (point) => point.value) * 1.05,
    ])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const line = d3
    .line()
    .defined((point) => point.value !== null)
    .x((point) => x(point.yearDecimal))
    .y((point) => y(point.value));

  svg
    .append("g")
    .attr("class", "analysis-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues([2000, 2004, 2008, 2012, 2016, 2020, 2024]).tickFormat((value) => String(value)));

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
    .attr("x1", x(periodToDecimal(BREAK_PERIOD)))
    .attr("x2", x(periodToDecimal(BREAK_PERIOD)))
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom);

  svg
    .append("text")
    .attr("class", "analysis-break-label")
    .attr("x", x(periodToDecimal(BREAK_PERIOD)) + 6)
    .attr("y", margin.top + 12)
    .text("2008");

  svg
    .append("g")
    .selectAll("path")
    .data(series)
    .join("path")
    .attr("class", "analysis-line")
    .attr("fill", "none")
    .attr("stroke", (entry) => entry.color)
    .attr("stroke-width", 2.8)
    .attr("d", (entry) => line(entry.values));

  const endpoints = series
    .map((entry) => ({
      color: entry.color,
      point: entry.values[entry.values.length - 1],
    }))
    .filter((entry) => entry.point && entry.point.value !== null);
  svg
    .append("g")
    .selectAll("circle")
    .data(endpoints)
    .join("circle")
    .attr("cx", (entry) => x(entry.point.yearDecimal))
    .attr("cy", (entry) => y(entry.point.value))
    .attr("r", 3.4)
    .attr("fill", (entry) => entry.color);

  renderLegend(svg, width - margin.right - 230, 20, series);
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
    .attr("fill", (entry) => entry.color);

  rows
    .append("text")
    .attr("x", 16)
    .attr("y", 9)
    .text((entry) => entry.label);
}

function normalizeSeries(points, basePeriod) {
  const basePoint = points.find((point) => point.period === basePeriod);
  if (!basePoint || basePoint.value <= 0) {
    return points.map((point) => ({
      ...point,
      yearDecimal: periodToDecimal(point.period),
      value: null,
    }));
  }

  return points.map((point) => ({
    ...point,
    yearDecimal: periodToDecimal(point.period),
    value: point.value / basePoint.value,
  }));
}

function periodToDecimal(period) {
  const [yearText, quarterText] = period.split("-Q");
  const year = Number.parseInt(yearText, 10);
  const quarter = Number.parseInt(quarterText, 10);
  return year + (quarter - 1) / 4;
}
