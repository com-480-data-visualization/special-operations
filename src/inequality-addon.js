import * as d3 from "d3";

const COLORS = {
  usa: "#ff9f9a",
  euroArea: "#7dc4ff",
  neutral: "#f7c66b",
  labour: "#8de0c1",
};

export async function renderInequalityAddon(coreData) {
  const container = document.getElementById("analysis-inequality-addon");
  if (!container) return;
  container.textContent = "";

  const data = await d3.json("./inequality_addon.json");
  if (!data) return;

  renderAddon(container, data, coreData);
}

function renderAddon(container, data, coreData) {
  const wrapper = d3.select(container).append("div").attr("class", "inequality-addon-grid");
  const rebound = getReboundMetrics(coreData);
  const distribution = getDistributionMetrics(data);
  const labour = getLabourMetrics(data.labourShare);

  const reboundCard = wrapper.append("section").attr("class", "inequality-addon-card");
  reboundCard.append("h4").text("1. Rebound gap");
  reboundCard
    .append("p")
    .attr("class", "inequality-addon-card__body")
    .text("Same crisis year, different recovery. US fundamentals improve more, but market-linked gains separate much harder.");
  drawReboundChart(reboundCard.append("div").attr("class", "analysis-chart").node(), rebound);
  reboundCard
    .append("p")
    .attr("class", "analysis-card__note")
    .text(`Indexed from 2008 to latest common year: US ETF ${formatMultiple(rebound.find((d) => d.id === "usa-etf").value)}, Europe ETF ${formatMultiple(rebound.find((d) => d.id === "eu-etf").value)}. GDP per capita gap exists, but market gap is larger.`);

  const destinationCard = wrapper.append("section").attr("class", "inequality-addon-card inequality-addon-card--table");
  destinationCard.append("h4").text("2. Where did gains go?");
  destinationCard
    .append("p")
    .attr("class", "inequality-addon-card__body")
    .text("US recovery converted into household financial capital gains far more strongly. Wealth concentration also rises on both sides.");
  drawDistributionTable(destinationCard.append("div").attr("class", "inequality-comparison").node(), distribution);
  destinationCard
    .append("p")
    .attr("class", "analysis-card__note")
    .text("Symmetry: top wealth share rises in both regions. Asymmetry: US household financial gains are much larger relative to disposable income.");

  const labourCard = wrapper.append("section").attr("class", "inequality-addon-card");
  labourCard.append("h4").text("3. Did workers share?");
  labourCard
    .append("p")
    .attr("class", "inequality-addon-card__body")
    .text("US workers receive a smaller slice of output after 2008. EU labour share is flatter, despite weaker market rebound.");
  drawLabourDeltaChart(labourCard.append("div").attr("class", "analysis-chart").node(), labour);
  labourCard
    .append("p")
    .attr("class", "analysis-card__note")
    .text(`ILO labour-share estimates: US ${formatSigned(labour.usa.delta)} pp from 2008 to 2025; EU-27 ${formatSigned(labour.eu.delta)} pp.`);
}

function drawReboundChart(container, rows) {
  const width = 380;
  const height = 240;
  const margin = { top: 18, right: 62, bottom: 42, left: 96 };
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "US and Europe rebound multiples since 2008");
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(rows, (entry) => entry.value) * 1.12])
    .nice()
    .range([margin.left, width - margin.right]);
  const y = d3
    .scaleBand()
    .domain(rows.map((entry) => entry.label))
    .range([margin.top, height - margin.bottom])
    .padding(0.28);

  svg
    .append("g")
    .attr("class", "analysis-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat((value) => `${value.toFixed(1)}x`));
  svg
    .append("g")
    .attr("class", "analysis-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg
    .append("line")
    .attr("class", "analysis-baseline-line")
    .attr("x1", x(1))
    .attr("x2", x(1))
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom);

  svg
    .append("g")
    .selectAll("rect")
    .data(rows)
    .join("rect")
    .attr("class", "analysis-bar")
    .attr("x", x(0))
    .attr("y", (entry) => y(entry.label))
    .attr("width", (entry) => x(entry.value) - x(0))
    .attr("height", y.bandwidth())
    .attr("rx", 8)
    .attr("fill", (entry) => entry.color);

  svg
    .append("g")
    .selectAll("text")
    .data(rows)
    .join("text")
    .attr("class", "analysis-value-label")
    .attr("x", (entry) => x(entry.value) + 7)
    .attr("y", (entry) => y(entry.label) + y.bandwidth() / 2 + 4)
    .text((entry) => formatMultiple(entry.value));
}

function drawDistributionTable(container, metrics) {
  const rows = [
    ["Capital gains / income", `${metrics.capitalGains.usa.toFixed(1)}%`, `${metrics.capitalGains.europe.toFixed(1)}%`],
    ["Top 10 wealth share", `${formatSigned(metrics.wealth.usa.top10Delta)} pp`, `${formatSigned(metrics.wealth.europe.top10Delta)} pp`],
    ["Bottom 50 wealth share", `${formatSigned(metrics.wealth.usa.bottom50Delta)} pp`, `${formatSigned(metrics.wealth.europe.bottom50Delta)} pp`],
  ];

  const table = d3.select(container).append("div").attr("class", "inequality-matrix");
  table.append("div").attr("class", "inequality-matrix__cell inequality-matrix__cell--head").text("");
  table.append("div").attr("class", "inequality-matrix__cell inequality-matrix__cell--head").text("US");
  table.append("div").attr("class", "inequality-matrix__cell inequality-matrix__cell--head").text("EU / EA");

  rows.forEach(([label, us, eu]) => {
    table.append("div").attr("class", "inequality-matrix__cell inequality-matrix__label").text(label);
    table.append("div").attr("class", "inequality-matrix__cell inequality-matrix__value inequality-matrix__value--us").text(us);
    table.append("div").attr("class", "inequality-matrix__cell inequality-matrix__value inequality-matrix__value--eu").text(eu);
  });
}

function drawLabourDeltaChart(container, labour) {
  const rows = [
    { label: "United States", value: labour.usa.delta, color: COLORS.usa },
    { label: "EU-27", value: labour.eu.delta, color: COLORS.euroArea },
  ];
  const width = 380;
  const height = 240;
  const margin = { top: 30, right: 54, bottom: 42, left: 94 };
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Labour share change from 2008 to 2025");
  const x = d3
    .scaleLinear()
    .domain([-6, 1])
    .range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(rows.map((entry) => entry.label)).range([margin.top, height - margin.bottom]).padding(0.34);

  svg
    .append("g")
    .attr("class", "analysis-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat((value) => `${formatSigned(value)} pp`));
  svg
    .append("g")
    .attr("class", "analysis-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg
    .append("line")
    .attr("class", "analysis-baseline-line")
    .attr("x1", x(0))
    .attr("x2", x(0))
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom);

  svg
    .append("g")
    .selectAll("rect")
    .data(rows)
    .join("rect")
    .attr("class", "analysis-bar")
    .attr("x", (entry) => Math.min(x(0), x(entry.value)))
    .attr("y", (entry) => y(entry.label))
    .attr("width", (entry) => Math.abs(x(entry.value) - x(0)))
    .attr("height", y.bandwidth())
    .attr("rx", 8)
    .attr("fill", (entry) => entry.color);

  svg
    .append("g")
    .selectAll("text")
    .data(rows)
    .join("text")
    .attr("class", "analysis-value-label")
    .attr("x", (entry) => x(entry.value) - 8)
    .attr("y", (entry) => y(entry.label) + y.bandwidth() / 2 + 4)
    .attr("text-anchor", "end")
    .text((entry) => `${formatSigned(entry.value)} pp`);

  svg
    .append("text")
    .attr("class", "analysis-break-label")
    .attr("x", margin.left)
    .attr("y", 14)
    .text("Change in labour share, 2008 to 2025");
}

function getReboundMetrics(data) {
  const yearIndex = data.years.indexOf(2008);
  const latestIndex = data.years.indexOf(data.latestYear);
  const rows = [
    {
      id: "usa-gdp-capita",
      label: "US GDP / capita",
      color: COLORS.usa,
      value: getIndexedValue(data.countries.USA.timeseries["GDP per Capita"].normalized, yearIndex, latestIndex),
    },
    {
      id: "eu-gdp-capita",
      label: "Europe GDP / capita",
      color: COLORS.euroArea,
      value: getIndexedValue(data.regionsData.Europe.timeseries["GDP per Capita"].normalized, yearIndex, latestIndex),
    },
    {
      id: "usa-etf",
      label: "US ETF",
      color: COLORS.usa,
      value: getIndexedValue(data.countries.USA.timeseries["ETF Price"].normalized, yearIndex, latestIndex),
    },
    {
      id: "eu-etf",
      label: "Europe ETF",
      color: COLORS.euroArea,
      value: getIndexedValue(data.regionsData.Europe.timeseries["ETF Price"].normalized, yearIndex, latestIndex),
    },
  ];
  return rows.filter((entry) => Number.isFinite(entry.value));
}

function getDistributionMetrics(data) {
  const usWealth = getBoundaryRows(data.wealthShares.usa, "2008-Q4");
  const euWealth = getBoundaryRows(data.wealthShares.euroArea, "2009-Q1");
  return {
    capitalGains: {
      usa: data.capitalGainsVsIncome.find((entry) => entry.id === "usa").value,
      europe: data.capitalGainsVsIncome.find((entry) => entry.id === "ea20").value,
    },
    wealth: {
      usa: {
        top10Delta: usWealth.end.top10 - usWealth.start.top10,
        bottom50Delta: usWealth.end.bottom50 - usWealth.start.bottom50,
      },
      europe: {
        top10Delta: euWealth.end.top10 - euWealth.start.top10,
        bottom50Delta: euWealth.end.bottom50 - euWealth.start.bottom50,
      },
    },
  };
}

function getLabourMetrics(rows) {
  const byArea = (area) => rows.filter((row) => row.area === area);
  const us = getYearBoundaryRows(byArea("USA"), 2008, 2025);
  const eu = getYearBoundaryRows(byArea("X92"), 2008, 2025);
  return {
    usa: { delta: us.end.value - us.start.value },
    eu: { delta: eu.end.value - eu.start.value },
  };
}

function getIndexedValue(values, baseIndex, latestIndex) {
  const base = values[baseIndex];
  const latest = values[latestIndex];
  return base && latest ? latest / base : null;
}

function getBoundaryRows(rows, startPeriod) {
  return {
    start: rows.find((row) => row.period === startPeriod) ?? rows[0],
    end: rows.at(-1),
  };
}

function getYearBoundaryRows(rows, startYear, endYear) {
  return {
    start: rows.find((row) => row.year === startYear),
    end: rows.find((row) => row.year === endYear) ?? rows.at(-1),
  };
}

function formatMultiple(value) {
  return `${value.toFixed(2)}x`;
}

function formatSigned(value) {
  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }
  return value.toFixed(1);
}
