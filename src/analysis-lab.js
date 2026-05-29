import * as d3 from "d3";

const TEXT = {
  breakFinder: "1. Break-year finder",
  heatmap: "2. Decoupling heatmap",
  scorecard: "3. Markets vs people",
  timeline: "4. Divergence timeline",
  gainMatrix: "5. Gain destination matrix",
  archetypes: "6. Region archetypes",
  counterfactual: "7. Counterfactual trend",
};

const COLORS = {
  us: "#ff9f9a",
  eu: "#7dc4ff",
  accent: "#f7c66b",
  soft: "#8de0c1",
};

export async function renderAnalysisLab(container) {
  if (!container) return;
  container.textContent = "";
  const data = await d3.json("./analysis_lab_data.json");
  if (!data) return;

  const grid = d3.select(container).append("div").attr("class", "analysis-lab-grid");
  addCard(grid, TEXT.breakFinder, "Candidate break years by metric; higher = better fit.", (node) => renderBreakFinder(node, data.breakFinder));
  addCard(grid, TEXT.heatmap, "Post-2008 region-pair divergence; darker = bigger split.", (node) => renderHeatmap(node, data.heatmap));
  addCard(grid, TEXT.scorecard, "Same US/Europe comparison across markets, labour, health, happiness.", (node) => renderScorecard(node, data.scorecard));
  addCard(grid, TEXT.timeline, "US/Europe gap, indexed to 2008 = 1.", (node) => renderTimeline(node, data.timeline));
  addCard(grid, TEXT.gainMatrix, "Compact answer to where gains went.", (node) => renderGainMatrix(node, data.scorecard));
  addCard(grid, TEXT.archetypes, "Real growth vs market rebound after 2008.", (node) => renderArchetypes(node, data.archetypes));
  addCard(grid, TEXT.counterfactual, "Actual path vs 2000-2008 projected trend.", (node) => renderCounterfactual(node, data.counterfactual));
}

function addCard(grid, title, body, render) {
  const card = grid.append("section").attr("class", "analysis-lab-card");
  card.append("h4").text(title);
  card.append("p").attr("class", "analysis-lab-card__body").text(body);
  const chart = card.append("div").attr("class", "analysis-chart analysis-lab-chart").node();
  render(chart);
}

function renderBreakFinder(container, rows) {
  const width = 520;
  const height = 260;
  const margin = { top: 18, right: 18, bottom: 48, left: 48 };
  const svg = baseSvg(container, width, height, "Break-year finder");
  const years = rows[0].scores.map((entry) => entry.year);
  const x0 = d3.scaleBand().domain(years).range([margin.left, width - margin.right]).padding(0.12);
  const x1 = d3.scaleBand().domain(rows.map((row) => row.metric)).range([0, x0.bandwidth()]).padding(0.08);
  const y = d3.scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);
  const colors = d3.scaleOrdinal().domain(rows.map((row) => row.metric)).range([COLORS.us, COLORS.eu, COLORS.accent]);

  svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x0).tickFormat(String));
  svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4));

  svg
    .append("g")
    .selectAll("g")
    .data(rows.flatMap((row) => row.scores.map((score) => ({ ...score, metric: row.metric, bestYear: row.bestYear }))))
    .join("rect")
    .attr("class", "analysis-bar")
    .attr("x", (entry) => x0(entry.year) + x1(entry.metric))
    .attr("y", (entry) => y(entry.score))
    .attr("width", x1.bandwidth())
    .attr("height", (entry) => y(0) - y(entry.score))
    .attr("fill", (entry) => colors(entry.metric))
    .attr("opacity", (entry) => entry.year === entry.bestYear ? 1 : 0.38);

  renderLegend(svg, width - 160, 20, rows.map((row) => ({ label: `${row.metric}: ${row.bestYear}`, color: colors(row.metric) })));
}

function renderHeatmap(container, heatmap) {
  let metric = "GDP per Capita";
  const wrapper = d3.select(container).append("div").attr("class", "analysis-lab-stack");
  const buttons = wrapper.append("div").attr("class", "analysis-lab-toggles");
  const chart = wrapper.append("div").attr("class", "analysis-lab-inner-chart");
  ["GDP per Capita", "ETF Price", "Market Cap"].forEach((name) => {
    buttons
      .append("button")
      .attr("type", "button")
      .attr("data-active", name === metric)
      .text(name.replace(" per Capita", "/cap"))
      .on("click", function () {
        metric = name;
        buttons.selectAll("button").attr("data-active", (d, i, nodes) => nodes[i] === this);
        draw();
      });
  });
  draw();

  function draw() {
    chart.text("");
    const width = 480;
    const height = 240;
    const margin = { top: 24, right: 12, bottom: 62, left: 104 };
    const svg = baseSvg(chart.node(), width, height, "Decoupling heatmap");
    const regions = heatmap.regions;
    const cells = heatmap.cells.filter((cell) => cell.metric === metric);
    const byKey = new Map(cells.map((cell) => [`${cell.a}|${cell.b}`, cell]));
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, d3.max(cells, (cell) => cell.value) || 1]);
    const x = d3.scaleBand().domain(regions).range([margin.left, width - margin.right]).padding(0.08);
    const y = d3.scaleBand().domain(regions).range([margin.top, height - margin.bottom]).padding(0.08);

    svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x)).selectAll("text").attr("transform", "rotate(-28)").attr("text-anchor", "end");
    svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y));

    const matrix = [];
    regions.forEach((a) => {
      regions.forEach((b) => {
        if (a === b) return;
        matrix.push(byKey.get(`${a}|${b}`) ?? byKey.get(`${b}|${a}`));
      });
    });
    svg
      .append("g")
      .selectAll("rect")
      .data(matrix.filter(Boolean))
      .join("rect")
      .attr("x", (cell) => x(cell.b))
      .attr("y", (cell) => y(cell.a))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("rx", 5)
      .attr("fill", (cell) => color(cell.value))
      .attr("opacity", 0.86);
  }
}

function renderScorecard(container, rows) {
  const metrics = [
    ["GDP/cap", (row) => `${row.gdpPerCapita.toFixed(2)}x`],
    ["Market", (row) => `${row.market.toFixed(2)}x`],
    ["Cap gains", (row) => `${row.capitalGainsIncome.toFixed(1)}%`],
    ["Labour", (row) => `${signed(row.labourShareDelta)} pp`],
    ["Life", (row) => `${signed(row.lifeExpectancyDelta)} yr`],
    ["Happy", (row) => signed(row.happinessDelta)],
  ];
  renderMatrix(container, ["", ...metrics.map(([label]) => label)], rows.map((row) => [row.region, ...metrics.map(([, value]) => value(row))]));
}

function renderTimeline(container, series) {
  renderLineChart(container, {
    width: 520,
    height: 260,
    label: "Divergence timeline",
    series: series.map((entry, index) => ({
      label: entry.label,
      color: [COLORS.us, COLORS.eu, COLORS.accent][index],
      values: entry.values,
    })),
    yFormat: (value) => `${value.toFixed(1)}x`,
  });
}

function renderGainMatrix(container, rows) {
  const us = rows.find((row) => row.region === "United States");
  const eu = rows.find((row) => row.region === "Europe");
  renderMatrix(container, ["Question", "US", "Europe"], [
    ["Growth", `${us.gdpPerCapita.toFixed(2)}x`, `${eu.gdpPerCapita.toFixed(2)}x`],
    ["Markets", `${us.market.toFixed(2)}x`, `${eu.market.toFixed(2)}x`],
    ["Capital gains", `${us.capitalGainsIncome.toFixed(1)}%`, `${eu.capitalGainsIncome.toFixed(1)}%`],
    ["Labour share", `${signed(us.labourShareDelta)} pp`, `${signed(eu.labourShareDelta)} pp`],
  ]);
}

function renderArchetypes(container, rows) {
  const width = 520;
  const height = 280;
  const margin = { top: 22, right: 22, bottom: 48, left: 58 };
  const svg = baseSvg(container, width, height, "Region archetypes");
  const x = d3.scaleLinear().domain([0.8, d3.max(rows, (row) => row.gdpPerCapitaMultiple) * 1.08]).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0.6, d3.max(rows, (row) => row.marketMultiple) * 1.1]).range([height - margin.bottom, margin.top]);
  const size = d3.scaleSqrt().domain(d3.extent(rows, (row) => row.gdp)).range([7, 22]);
  svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5).tickFormat((value) => `${value.toFixed(1)}x`));
  svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value.toFixed(1)}x`));
  svg.append("text").attr("class", "analysis-break-label").attr("x", width / 2).attr("y", height - 8).attr("text-anchor", "middle").text("GDP/cap multiple after 2008");
  svg.append("text").attr("class", "analysis-break-label").attr("x", 14).attr("y", 18).text("Market multiple");
  const points = svg.append("g").selectAll("g").data(rows).join("g");
  points.append("circle").attr("cx", (row) => x(row.gdpPerCapitaMultiple)).attr("cy", (row) => y(row.marketMultiple)).attr("r", (row) => size(row.gdp)).attr("fill", (row) => row.color).attr("opacity", 0.78);
  points.append("text").attr("class", "analysis-value-label").attr("x", (row) => x(row.gdpPerCapitaMultiple) + 9).attr("y", (row) => y(row.marketMultiple) + 4).text((row) => row.label);
}

function renderCounterfactual(container, rows) {
  const selected = rows.filter((row) => row.label.includes("GDP/cap"));
  renderLineChart(container, {
    width: 520,
    height: 280,
    label: "Counterfactual trend",
    series: selected.flatMap((row) => [
      { label: row.label, color: row.color, values: row.actual },
      { label: `${row.label} trend`, color: row.color, values: row.trend, dash: "5 5" },
    ]),
    yFormat: (value) => `${value.toFixed(1)}x`,
  });
}

function renderMatrix(container, headers, rows) {
  const matrix = d3.select(container).append("div").attr("class", "analysis-lab-matrix").style("--columns", headers.length);
  headers.forEach((header) => matrix.append("div").attr("class", "analysis-lab-matrix__head").text(header));
  rows.forEach((row) => row.forEach((cell, index) => matrix.append("div").attr("class", `analysis-lab-matrix__cell${index === 0 ? " analysis-lab-matrix__label" : ""}`).text(cell)));
}

function renderLineChart(container, config) {
  const width = config.width;
  const height = config.height;
  const margin = { top: 22, right: 140, bottom: 42, left: 52 };
  const svg = baseSvg(container, width, height, config.label);
  const allPoints = config.series.flatMap((entry) => entry.values).filter((point) => point.value !== null);
  const x = d3.scaleLinear().domain(d3.extent(allPoints, (point) => point.year)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(allPoints, (point) => point.value) * 1.08]).nice().range([height - margin.bottom, margin.top]);
  const line = d3.line().defined((point) => point.value !== null).x((point) => x(point.year)).y((point) => y(point.value));
  svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickValues([2008, 2012, 2016, 2020, 2023]).tickFormat(String));
  svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(config.yFormat));
  svg.append("line").attr("class", "analysis-baseline-line").attr("x1", margin.left).attr("x2", width - margin.right).attr("y1", y(1)).attr("y2", y(1));
  svg.append("g").selectAll("path").data(config.series).join("path").attr("class", "analysis-line").attr("fill", "none").attr("stroke", (entry) => entry.color).attr("stroke-width", 2.4).attr("stroke-dasharray", (entry) => entry.dash ?? null).attr("d", (entry) => line(entry.values));
  renderLegend(svg, width - margin.right + 16, margin.top, config.series.map((entry) => ({ label: entry.label, color: entry.color, dash: entry.dash })));
}

function renderLegend(svg, x, y, items) {
  const rows = svg.append("g").attr("class", "analysis-legend").attr("transform", `translate(${x},${y})`).selectAll("g").data(items).join("g").attr("transform", (_, index) => `translate(0, ${index * 18})`);
  rows.append("line").attr("x1", 0).attr("x2", 12).attr("y1", 5).attr("y2", 5).attr("stroke", (entry) => entry.color).attr("stroke-width", 2.5).attr("stroke-dasharray", (entry) => entry.dash ?? null);
  rows.append("text").attr("x", 17).attr("y", 9).text((entry) => entry.label);
}

function baseSvg(container, width, height, label) {
  return d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img").attr("aria-label", label);
}

function signed(value) {
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}
