import * as d3 from "d3";


const COUNTRY_COLOR = d3.scaleOrdinal(d3.schemeTableau10.concat(d3.schemeCategory10));
const SECTOR_COLOR = d3.scaleOrdinal()
  .domain([
    "Financials",
    "Information Technology",
    "Consumer Discretionary",
    "Health Care",
    "Industrials",
    "Consumer Staples",
    "Energy",
    "Materials",
    "Communication Services",
    "Utilities",
    "Real Estate",
    "Cash and/or Derivatives",
  ])
  .range([
    "#2a9d8f",
    "#e76f51",
    "#118ab2",
    "#8ab17d",
    "#6d597a",
    "#e9c46a",
    "#d62828",
    "#5e6472",
    "#b56576",
    "#f4a261",
    "#6c757d",
    "#64748b",
  ])
  .unknown("#64748b");
const OTHER_COLOR = "#6f7684";
const SHORT_LABELS = new Map([
  ["United States", "US"],
  ["United Kingdom", "UK"],
  ["Switzerland", "CH"],
  ["Information Technology", "Info Tech"],
  ["Consumer Discretionary", "Cons. Disc."],
  ["Consumer Staples", "Staples"],
  ["Communication Services", "Comms"],
  ["Cash and/or Derivatives", "Cash"],
]);

export function createTreemap(container, data, options = {}) {
  const el = typeof container === "string" ? document.querySelector(container) : container;
  if (!el) throw new Error("Missing treemap container");
  const {
    dataKey = "data",
    emptyText = "No treemap data for this snapshot.",
    color = (name) => isOther(name) ? OTHER_COLOR : COUNTRY_COLOR(name),
    tooltipTitle = "ACWI share",
    tooltipSections = countryTooltipSections,
  } = options;

  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  let width = getInnerWidth();
  let height = getInnerHeight();
  let currentKey = (data?.snapshots?.at(-1)?.key || data?.years?.at(-1) || "");

  const svg = d3
    .select(el)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .style("max-width", "100%");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const emptyLabel = g
    .append("text")
    .attr("class", "tile-label")
    .attr("x", 12)
    .attr("y", 28)
    .attr("fill", "#111");

  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "treemap-tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("display", "none");

  function renderKey(key) {
    currentKey = String(key);
    const nodesForSnapshot = (data[dataKey] && data[dataKey][currentKey]) || [];
    emptyLabel.text(nodesForSnapshot.length ? "" : emptyText);

    const root = d3
      .hierarchy({ name: "root", children: nodesForSnapshot })
      .sum((d) => d.value || 0)
      .sort((a, b) => {
        if (isOther(a.data.name)) return 1;
        if (isOther(b.data.name)) return -1;
        return b.value - a.value;
      });

    d3.treemap()
      .size([width, height])
      .tile(d3.treemapSquarify.ratio(1))
      .paddingInner(1.5)
      .paddingOuter(2)(root);

    const leaves = root.leaves();

    const selection = g
      .selectAll("g.tile")
      .data(leaves, (d) => d.data.name);

    const entered = selection.enter().append("g").attr("class", "tile");

    entered
      .append("rect")
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("stroke", "none")
      .attr("stroke-width", 0);

    entered
      .append("text")
      .attr("class", "tile-label")
      .style("pointer-events", "none")
      .attr("fill", "#fff");

    const merged = entered.merge(selection);

    merged.select("rect").transition().duration(450)
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("fill", (d) => color(d.data.name, d));

    merged
      .select("text")
      .attr("x", (d) => d.x0 + 6)
      .attr("y", (d) => d.y0 + 16)
      .attr("font-size", (d) => labelSize(d))
      .attr("font-weight", 700)
      .attr("paint-order", null)
      .attr("stroke", "none")
      .attr("stroke-width", 0)
      .each(function updateLabel(d) {
        const text = d3.select(this);
        const w = d.x1 - d.x0, h = d.y1 - d.y0;
        const fontSize = labelSize(d);
        const lines = labelLines(d.data.name, w, h, fontSize);
        text.text("");
        if (lines.length) {
          const x = d.x0 + (w > 86 ? 8 : 5);
          lines.forEach((line, index) => {
            text
              .append("tspan")
              .attr("x", x)
              .attr("dy", index === 0 ? 0 : fontSize + 2)
              .text(line);
          });
          if (h >= lines.length * (fontSize + 2) + 26 && w > 42) {
            text
              .append("tspan")
              .attr("x", x)
              .attr("dy", fontSize + 3)
              .attr("font-size", Math.max(9.5, fontSize - 2))
              .attr("font-weight", 650)
              .text(formatPercent(d.value));
          }
          return;
        }
        if (w > 50 && h > 24) {
          text.append("tspan").attr("x", d.x0 + 5).attr("dy", 0).text(formatPercent(d.value));
        }
      });

    merged
      .on("mousemove", (event, d) => {
        let html = `<strong>${d.data.name}</strong><br/>${tooltipTitle}: ${formatPercent(d.value)}`;
        html += tooltipSections(d.data);
        tooltip
          .style("display", "block")
          .html(html);
        positionTooltip(event);
      })
      .on("mouseleave", () => tooltip.style("display", "none"));

    selection.exit().remove();
  }

  function renderYear(year) {
    const yearStr = String(year);
    const snapshot = (data.snapshots || [])
      .slice()
      .reverse()
      .find((candidate) => String(candidate.year) === yearStr);
    renderKey(snapshot?.key || yearStr);
  }

  function positionTooltip(event) {
    const gap = 12;
    const node = tooltip.node();
    if (!node) return;

    const tooltipBox = node.getBoundingClientRect();
    const viewportRight = window.scrollX + window.innerWidth;
    const viewportBottom = window.scrollY + window.innerHeight;
    let left = event.pageX + gap;
    let top = event.pageY + gap;

    if (left + tooltipBox.width + gap > viewportRight) {
      left = event.pageX - tooltipBox.width - gap;
    }
    if (top + tooltipBox.height + gap > viewportBottom) {
      top = event.pageY - tooltipBox.height - gap;
    }

    tooltip
      .style("left", `${Math.max(window.scrollX + gap, left)}px`)
      .style("top", `${Math.max(window.scrollY + gap, top)}px`);
  }

  function formatPercent(v) {
    if (v == null) return "—";
    return d3.format(".2%")(v);
  }

  function isOther(name) {
    return String(name || "").trim().toLowerCase() === "other";
  }

  function labelSize(d) {
    const w = d.x1 - d.x0;
    const h = d.y1 - d.y0;
    if (w > 190 && h > 80) return 15;
    if (w > 110 && h > 48) return 12.5;
    return 10.5;
  }

  function labelLines(name, width, height, fontSize) {
    const label = String(name || "").trim();
    const available = width - 12;
    const maxLines = Math.max(1, Math.floor((height - 22) / (fontSize + 2)));
    if (available <= 24 || maxLines < 1) return [];
    if (estimatedTextWidth(label, fontSize) <= available) return [label];

    const words = label.split(/\s+/).filter(Boolean);
    if (
      words.length > 1
      && words.length <= maxLines
      && words.every((word) => estimatedTextWidth(word, fontSize) <= available)
    ) {
      return words;
    }

    const shortLabel = SHORT_LABELS.get(label);
    if (shortLabel && estimatedTextWidth(shortLabel, fontSize) <= available) {
      return [shortLabel];
    }

    if (words.length > 1 && maxLines >= 2) {
      const wrapped = wrapWords(words, available, fontSize, maxLines);
      if (wrapped.length > 0) return wrapped;
    }
    return [];
  }

  function wrapWords(words, available, fontSize, maxLines) {
    const lines = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (estimatedTextWidth(candidate, fontSize) <= available) {
        current = candidate;
      } else {
        if (!current || lines.length >= maxLines - 1) return [];
        lines.push(current);
        current = word;
      }
    }
    if (current && estimatedTextWidth(current, fontSize) <= available) {
      lines.push(current);
    }
    return lines.length <= maxLines ? lines : [];
  }

  function estimatedTextWidth(label, fontSize) {
    return label.length * fontSize * 0.56;
  }

  function getInnerWidth() {
    return Math.max(260, el.clientWidth - margin.left - margin.right);
  }

  function getInnerHeight() {
    const outerWidth = getInnerWidth() + margin.left + margin.right;
    const outerHeight = Math.min(520, Math.max(330, outerWidth * 0.86));
    return outerHeight - margin.top - margin.bottom;
  }

  return {
    renderKey,
    renderYear,
    resize() {
      width = getInnerWidth();
      height = getInnerHeight();
      svg
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);
      renderKey(currentKey);
    },
  };
}

export function createSectorTreemap(container, data) {
  return createTreemap(container, data, {
    dataKey: "sectorData",
    emptyText: "No sector data for this snapshot.",
    color: (name) => SECTOR_COLOR(name),
    tooltipTitle: "MSCI ACWI sector cap",
    tooltipSections: () => "",
  });
}

function countryTooltipSections(data) {
  const sectors = Object.entries(data.sectors || {})
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!sectors.length) return "";
  let html = '<br/><span class="treemap-tooltip__section">Country sector mix</span><ul>';
  for (const [sector, value] of sectors) {
    html += `<li>${sector}: ${formatNumber(value)}%</li>`;
  }
  html += "</ul>";
  return html;
}

function formatNumber(v) {
  if (v == null) return "—";
  return d3.format(".2f")(v);
}

export function mapSectorName(raw) {
  if (!raw) return "Other";
  const s = raw.trim().toLowerCase();
  if (s.includes("cash") || s.includes("derivate") || s.includes("derivative")) return "Cash and/or Derivatives";
  if (s.includes("it") || s.includes("information")) return "Information Technology";
  if (s.includes("financial") || s.includes("bank")) return "Financials";
  if (s.includes("nichtzykl") || s.includes("staples") || s.includes("staples")) return "Consumer Staples";
  if (s.includes("zykl") || s.includes("consum") && s.includes("zykl")) return "Consumer Discretionary";
  if (s.includes("gesundheit") || s.includes("health")) return "Health Care";
  if (s.includes("industrie") || s.includes("industr")) return "Industrials";
  if (s.includes("energie") || s.includes("energy")) return "Energy";
  if (s.includes("material") || s.includes("materials")) return "Materials";
  if (s.includes("kommunikation") || s.includes("communication") || s.includes("telecom")) return "Communication Services";
  if (s.includes("immobilien") || s.includes("realestate") || s.includes("real estate")) return "Real Estate";
  if (s.includes("versorg") || s.includes("utility") || s.includes("utilities")) return "Utilities";
  return raw;
}
