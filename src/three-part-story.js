import * as d3 from "d3";

const COLORS = {
  us: "#ff9f9a",
  eu: "#7dc4ff",
  accent: "#f7c66b",
  muted: "rgba(255, 255, 255, 0.2)",
};

export async function renderThreePartStory(container) {
  if (!container) return;
  container.textContent = "";
  const data = await d3.json("./analysis_lab_data.json");
  if (!data) return;
  const inequality = await d3.json("./inequality_addon.json").catch(() => null);
  const livingCostPay = await d3.json("./living_cost_pay_data.json").catch(() => null);
  const labourShareTrends = data.labourShareTrends?.length
    ? data.labourShareTrends
    : buildLabourShareTrends(inequality?.labourShare ?? []);
  const latestYear = data.scorecardYears?.end ?? data.latestYear ?? 2023;

  const root = d3.select(container).append("div").attr("class", "three-story");
  addPart(root, "1", "Before 2008", "", [
    ["2000 -> 2008", "", (node) => renderPreGrowth(node, data.preStory)],
    ["Industrial structure near the break", "", (node) => renderIndustrialStructure(node, data.preStory?.industrialStructure ?? [])],
  ]);
  addPart(root, "2", "2008 as the statistical break", "The best-fit break years cluster around the financial crisis. The useful point is not that 2008 is magic; it is that several independent series change slope around the same window, and the answer changes depending on whether we use headline current-dollar values or PPP values closer to lived purchasing power.", [
    ["Best break-year fit", "Piecewise-linear fit on the log US/Europe gap. Bars show relative BIC score across candidate break years, not statistical probability.", (node) => renderBreakFinder(node, data.breakFinder ?? [])],
    ["Post-break path vs old trend", "GDP/cap only: actual post-2008 GDP per capita path compared with a log-linear 2000-2008 GDP/cap trend projected forward.", (node) => renderCounterfactual(node, data.counterfactual ?? [])],
    ["Headline lens vs lived-output lens", "Current-USD GDP/cap makes the US-Europe split look much sharper after 2008. PPP GDP/cap narrows the split by correcting for price levels and purchasing power.", (node) => renderLensComparison(node, livingCostPay?.headlineLenses ?? [])],
  ]);
  addPart(root, "3", "After 2008: markets decouple more than output", `On a constant-PPP basis, US GDP/cap grows faster than Europe after 2008, but the bigger split is financial: US valuation proxies rebound while Europe’s ETF proxy remains below its 2008 level. The household question is narrower than “all living costs”: broad housing CPI does not clearly beat wages, but house prices and financial assets do, which matters most for non-capital owners.`, [
    [`2008-${latestYear}: output gap, larger market gap`, "GDP/cap is inflation- and purchasing-power-adjusted. Market and capital-gain figures are valuation measures placed on the same broad real/PPP scale, so read them as proxies rather than living-standard measures.", (node) => renderMarketGrowth(node, data.scorecard ?? [])],
    ["Pay vs housing pressure", "OECD average wages and housing indexes, rebased to 2008. Broad housing CPI does not outrun wages; house prices relative to wages rise on both sides, slightly more in the US sample.", (node) => renderPayCost(node, livingCostPay?.payCost ?? [])],
    ["Labour share before and after 2008", "ILO labour share measures the share of output paid to labour. Slopes compare pre-break trend with post-break trend.", (node) => renderLabourShareTrends(node, labourShareTrends)],
    ["Where it shows up for people", "Life expectancy and life satisfaction proxy welfare; labour share tests whether workers captured more of output. Together they make the US rebound look less like a clean population-level win.", (node) => renderOutcomeMatrix(node, data.scorecard ?? [])],
  ]);
}

function buildLabourShareTrends(rows) {
  return [
    ["USA", "United States", COLORS.us],
    ["X92", "EU-27", COLORS.eu],
  ].map(([area, label, color]) => {
    const values = rows
      .filter((row) => row.area === area)
      .map((row) => ({ year: row.year, value: row.value }))
      .sort((a, b) => a.year - b.year);
    return {
      area,
      label,
      color,
      values,
      preDelta: deltaBetween(values, 2004, 2008),
      postDelta: deltaBetween(values, 2008, 2025),
    };
  }).filter((row) => row.values.length);
}

function deltaBetween(values, startYear, endYear) {
  const byYear = new Map(values.map((row) => [row.year, row.value]));
  if (!byYear.has(startYear) || !byYear.has(endYear)) return null;
  return byYear.get(endYear) - byYear.get(startYear);
}

function addPart(root, number, title, body, cards) {
  const section = root.append("section").attr("class", "three-story-part");
  const header = section.append("div").attr("class", "three-story-part__header");
  header.append("span").attr("class", "three-story-part__number").text(number);
  const copy = header.append("div");
  copy.append("h4").text(title);
  if (body) copy.append("p").text(body);
  const grid = section.append("div").attr("class", "three-story-grid");
  cards.forEach(([cardTitle, cardBody, render], index) => {
    const card = grid.append("section").attr("class", `three-story-card${cards.length === 3 && index === 2 ? " three-story-card--wide" : ""}`);
    card.append("h5").text(cardTitle);
    if (cardBody) card.append("p").attr("class", "three-story-card__body").text(cardBody);
    const chart = card.append("div").attr("class", "three-story-chart").node();
    render(chart);
  });
}

function renderPreGrowth(container, preStory) {
  renderGroupedBars(container, {
    rows: preStory?.growth ?? [],
    keys: [
      ["us", "US", COLORS.us],
      ["europe", "Europe", COLORS.eu],
    ],
    valueFormat: (value) => `${value.toFixed(2)}x`,
    baseline: 1,
    maxPadding: 1.12,
  });
}

function renderIndustrialStructure(container, rows) {
  if (!rows.length) {
    d3.select(container).append("p").attr("class", "three-story-empty").text("Industrial World Bank indicators unavailable in this build.");
    return;
  }
  const ordered = [
    ...rows.filter((row) => ["manufacturing", "industry", "services"].includes(row.key)),
    ...rows.filter((row) => ["investment", "research"].includes(row.key)),
  ];
  renderGroupedBars(container, {
    rows: ordered,
    keys: [
      ["us", "US", COLORS.us],
      ["europe", "Europe", COLORS.eu],
    ],
    valueFormat: (value) => `${value.toFixed(1)}%`,
    baseline: 0,
    maxPadding: 1.18,
  });
  d3.select(container)
    .append("p")
    .attr("class", "story-footnote")
    .text("Manufacturing is inside industry; investment and R&D are not sectors.");
}

function renderBreakFinder(container, rows) {
  const wrap = d3.select(container).append("div").attr("class", "story-breaks");
  wrap
    .append("p")
    .attr("class", "story-methodology")
    .text("Method: for each candidate year 2005-2015, fit log(US series / Europe series) with intercept + time + post-break slope change. Score = inverted, min-max normalized BIC; 1 is best fit, 0 is worst among candidates.");
  rows.forEach((row) => {
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
      .attr("data-best", (score) => score.year === row.bestYear);
    item.append("span").attr("class", "story-break__axis-note").text("2005 -> 2015, height = relative BIC score");
  });
}

function renderCounterfactual(container, rows) {
  const selected = rows.filter((row) => row.label.includes("GDP/cap"));
  renderLineChart(container, {
    label: "GDP/cap trend break",
    series: selected.flatMap((row) => [
      { label: row.label.replace(" GDP/cap", ""), color: row.color, values: row.actual },
      { label: `${row.label.replace(" GDP/cap", "")} old trend`, color: row.color, values: row.trend, dash: "5 5" },
    ]),
  });
}

function renderLensComparison(container, rows) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  renderLineChart(container, {
    label: "GDP per capita lenses normalized to 2008",
    series: [
      { label: "US current USD", color: COLORS.us, values: byId.get("us-current")?.values ?? [] },
      { label: "Europe current USD", color: COLORS.eu, values: byId.get("eu-current")?.values ?? [] },
      { label: "US PPP", color: COLORS.us, values: byId.get("us-ppp")?.values ?? [], dash: "5 5" },
      { label: "Europe PPP", color: COLORS.eu, values: byId.get("eu-ppp")?.values ?? [], dash: "5 5" },
    ],
  });
  d3.select(container)
    .append("p")
    .attr("class", "story-footnote")
    .text("Solid = current USD headline lens; dashed = constant-PPP GDP/cap lens. Both are indexed to 2008 = 1.");
}

function renderPayCost(container, rows) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  renderLineChart(container, {
    label: "Pay and housing pressure normalized to 2008",
    series: [
      { label: "US real wage", color: COLORS.us, values: byId.get("us-real-wage")?.values ?? [] },
      { label: "Europe real wage", color: COLORS.eu, values: byId.get("eu-real-wage")?.values ?? [] },
      { label: "US home price/wage", color: "#ffcf9f", values: byId.get("us-house-price-wage")?.values ?? [], dash: "5 4" },
      { label: "Europe home price/wage", color: "#8bd7ff", values: byId.get("eu-house-price-wage")?.values ?? [], dash: "5 4" },
    ],
  });
  d3.select(container)
    .append("p")
    .attr("class", "story-footnote")
    .text("Real wages are CPI-adjusted average annual wages. Home price/wage divides residential house-price indexes by nominal average-wage indexes.");
}

function renderMarketGrowth(container, rows) {
  const chartRows = rows.map((row) => ({
    label: row.region.replace("United States", "US"),
    gdpPerCapita: row.gdpPerCapita,
    market: row.market,
  }));
  renderGroupedBars(container, {
    rows: chartRows,
    keys: [
      ["gdpPerCapita", "GDP/cap", COLORS.accent],
      ["market", "Market", COLORS.us],
    ],
    valueFormat: (value) => `${value.toFixed(2)}x`,
    baseline: 1,
    maxPadding: 1.12,
  });
}

function renderOutcomeMatrix(container, rows) {
  const metrics = [
    ["Capital gains / income", (row) => `${row.capitalGainsIncome.toFixed(1)}%`],
    ["Labour share", (row) => `${signed(row.labourShareDelta)} pp`],
    ["Life expectancy", (row) => `${signed(row.lifeExpectancyDelta)} yr`],
    ["Life satisfaction", (row) => signed(row.happinessDelta)],
  ];
  const grid = d3.select(container).append("div").attr("class", "story-outcome-grid");
  metrics.forEach(([label, value]) => {
    const item = grid.append("div").attr("class", "story-outcome");
    item.append("span").attr("class", "story-outcome__label").text(label);
    const values = item.append("div").attr("class", "story-outcome__values");
    rows.forEach((row) => {
      values
        .append("span")
        .attr("class", `story-outcome__value story-outcome__value--${row.region === "United States" ? "us" : "eu"}`)
        .text(`${row.region === "United States" ? "US" : "EU"} ${value(row)}`);
    });
  });
}

function renderLabourShareTrends(container, rows) {
  const width = 640;
  const height = 310;
  const margin = { top: 22, right: 134, bottom: 42, left: 52 };
  const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img").attr("aria-label", "Labour share trends before and after 2008");
  const allPoints = rows.flatMap((row) => row.values);
  if (!allPoints.length) {
    svg.append("text").attr("class", "analysis-value-label").attr("x", margin.left).attr("y", margin.top + 18).text("No labour-share data available.");
    return;
  }
  const x = d3.scaleLinear().domain(d3.extent(allPoints, (point) => point.year)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain(d3.extent(allPoints, (point) => point.value)).nice().range([height - margin.bottom, margin.top]);
  const line = d3.line().x((point) => x(point.year)).y((point) => y(point.value));
  svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickValues([2004, 2008, 2012, 2016, 2020, 2025]).tickFormat(String));
  svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value.toFixed(0)}%`));
  svg.append("line").attr("class", "analysis-break-line").attr("x1", x(2008)).attr("x2", x(2008)).attr("y1", margin.top).attr("y2", height - margin.bottom);
  svg.append("g").selectAll("path").data(rows).join("path").attr("class", "analysis-line").attr("fill", "none").attr("stroke", (row) => row.color).attr("stroke-width", 2.5).attr("d", (row) => line(row.values));
  renderLegend(svg, width - margin.right + 14, margin.top, rows.map((row) => ({ label: row.label, color: row.color })));

  const table = d3.select(container).append("div").attr("class", "story-labour-slopes");
  table.append("div").attr("class", "story-labour-slopes__head").text("Trend");
  table.append("div").attr("class", "story-labour-slopes__head").text("2004-2008");
  table.append("div").attr("class", "story-labour-slopes__head").text("2008-2025");
  rows.forEach((row) => {
    table.append("div").attr("class", "story-labour-slopes__label").text(row.label);
    table.append("div").text(`${signed(row.preDelta)} pp total`);
    table.append("div").text(`${signed(row.postDelta)} pp total`);
  });
}

function renderGroupedBars(container, config) {
  const rows = config.rows.filter((row) => config.keys.some(([key]) => row[key] !== null && row[key] !== undefined));
  if (!rows.length) {
    d3.select(container).append("p").attr("class", "three-story-empty").text("No comparable rows available.");
    return;
  }
  const width = 560;
  const height = Math.max(220, rows.length * 48 + 58);
  const margin = { top: 18, right: 72, bottom: 34, left: 104 };
  const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img").attr("aria-label", "Grouped comparison bars");
  const max = d3.max(rows, (row) => d3.max(config.keys, ([key]) => row[key] ?? 0)) || 1;
  const x = d3.scaleLinear().domain([0, max * config.maxPadding]).range([margin.left, width - margin.right]);
  const y0 = d3.scaleBand().domain(rows.map((row) => row.label)).range([margin.top, height - margin.bottom]).padding(0.25);
  const y1 = d3.scaleBand().domain(config.keys.map(([key]) => key)).range([0, y0.bandwidth()]).padding(0.14);

  svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5).tickFormat(config.valueFormat));
  svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y0));
  if (config.baseline !== undefined) {
    svg.append("line").attr("class", "analysis-baseline-line").attr("x1", x(config.baseline)).attr("x2", x(config.baseline)).attr("y1", margin.top).attr("y2", height - margin.bottom);
  }

  const barData = rows.flatMap((row) => config.keys.map(([key, label, color]) => ({ row, key, label, color, value: row[key] })).filter((entry) => entry.value !== null && entry.value !== undefined));
  svg
    .append("g")
    .selectAll("rect")
    .data(barData)
    .join("rect")
    .attr("class", "analysis-bar")
    .attr("x", x(0))
    .attr("y", (entry) => y0(entry.row.label) + y1(entry.key))
    .attr("width", (entry) => x(entry.value) - x(0))
    .attr("height", y1.bandwidth())
    .attr("rx", 5)
    .attr("fill", (entry) => entry.color)
    .attr("opacity", 0.86);
  svg
    .append("g")
    .selectAll("text")
    .data(barData)
    .join("text")
    .attr("class", "analysis-value-label")
    .attr("x", (entry) => x(entry.value) + 7)
    .attr("y", (entry) => y0(entry.row.label) + y1(entry.key) + y1.bandwidth() / 2 + 4)
    .text((entry) => config.valueFormat(entry.value));
  renderLegend(svg, width - margin.right + 8, margin.top, config.keys.map(([, label, color]) => ({ label, color })));
}

function renderLineChart(container, config) {
  const width = 560;
  const height = 270;
  const margin = { top: 18, right: 150, bottom: 38, left: 52 };
  const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img").attr("aria-label", config.label);
  const allPoints = config.series.flatMap((entry) => entry.values).filter((point) => point.value !== null);
  if (!allPoints.length) {
    svg.append("text").attr("class", "analysis-value-label").attr("x", margin.left).attr("y", margin.top + 18).text("No comparable trend points available.");
    return;
  }
  const x = d3.scaleLinear().domain(d3.extent(allPoints, (point) => point.year)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(allPoints, (point) => point.value) * 1.08]).nice().range([height - margin.bottom, margin.top]);
  const line = d3.line().defined((point) => point.value !== null).x((point) => x(point.year)).y((point) => y(point.value));
  const maxYear = d3.max(allPoints, (point) => point.year);
  const tickYears = [2008, 2012, 2016, 2020, maxYear].filter((year, index, all) => year && all.indexOf(year) === index);
  svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickValues(tickYears).tickFormat(String));
  svg.append("g").attr("class", "analysis-axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value.toFixed(1)}x`));
  svg.append("line").attr("class", "analysis-baseline-line").attr("x1", margin.left).attr("x2", width - margin.right).attr("y1", y(1)).attr("y2", y(1));
  svg.append("line").attr("class", "analysis-break-line").attr("x1", x(2008)).attr("x2", x(2008)).attr("y1", margin.top).attr("y2", height - margin.bottom);
  svg.append("g").selectAll("path").data(config.series).join("path").attr("class", "analysis-line").attr("fill", "none").attr("stroke", (entry) => entry.color).attr("stroke-width", 2.3).attr("stroke-dasharray", (entry) => entry.dash ?? null).attr("d", (entry) => line(entry.values));
  renderLegend(svg, width - margin.right + 14, margin.top, config.series.map((entry) => ({ label: entry.label, color: entry.color, dash: entry.dash })));
}

function renderLegend(svg, x, y, items) {
  const rows = svg.append("g").attr("class", "analysis-legend").attr("transform", `translate(${x},${y})`).selectAll("g").data(items).join("g").attr("transform", (_, index) => `translate(0, ${index * 18})`);
  rows.append("line").attr("x1", 0).attr("x2", 12).attr("y1", 5).attr("y2", 5).attr("stroke", (entry) => entry.color).attr("stroke-width", 2.5).attr("stroke-dasharray", (entry) => entry.dash ?? null);
  rows.append("text").attr("x", 17).attr("y", 9).text((entry) => entry.label);
}

function signed(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}
