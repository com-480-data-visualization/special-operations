import * as d3 from "d3";


const COUNTRY_COLOR = d3.scaleOrdinal(d3.schemeTableau10.concat(d3.schemeCategory10));
const OTHER_COLOR = "#6f7684";

export function createTreemap(container, data) {
  const el = typeof container === "string" ? document.querySelector(container) : container;
  if (!el) throw new Error("Missing treemap container");

  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  let width = el.clientWidth - margin.left - margin.right;
  let height = 360 - margin.top - margin.bottom;
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
    const nodesForSnapshot = (data.data && data.data[currentKey]) || [];
    emptyLabel.text(nodesForSnapshot.length ? "" : "No treemap data for this snapshot.");

    const root = d3
      .hierarchy({ name: "root", children: nodesForSnapshot })
      .sum((d) => d.value || 0)
      .sort((a, b) => {
        if (isOther(a.data.name)) return 1;
        if (isOther(b.data.name)) return -1;
        return b.value - a.value;
      });

    d3.treemap().size([width, height]).paddingInner(1.5).paddingOuter(2)(root);

    const leaves = root.leaves();

    const selection = g
      .selectAll("g.tile")
      .data(leaves, (d) => d.data.name);

    const entered = selection.enter().append("g").attr("class", "tile");

    entered
      .append("rect")
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("stroke", "rgba(255,255,255,0.78)")
      .attr("stroke-width", 0.8);

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
      .attr("fill", (d) => isOther(d.data.name) ? OTHER_COLOR : COUNTRY_COLOR(d.data.name));

    merged
      .select("text")
      .attr("x", (d) => d.x0 + 6)
      .attr("y", (d) => d.y0 + 16)
      .attr("font-size", (d) => labelSize(d))
      .attr("font-weight", 700)
      .attr("paint-order", "stroke")
      .attr("stroke", "rgba(5, 10, 18, 0.34)")
      .attr("stroke-width", 2)
      .attr("stroke-linejoin", "round")
      .each(function updateLabel(d) {
        const text = d3.select(this);
        const w = d.x1 - d.x0, h = d.y1 - d.y0;
        const name = fitName(d.data.name, w, labelSize(d));
        text.text("");
        if (name && w > 140 && h > 58) {
          text.append("tspan").attr("x", d.x0 + 8).attr("dy", 0).text(d.data.name);
          text
            .append("tspan")
            .attr("x", d.x0 + 8)
            .attr("dy", 17)
            .attr("font-size", 12)
            .attr("font-weight", 650)
            .text(formatPercent(d.value));
          return;
        }
        if (name && w > 76 && h > 38) {
          text.append("tspan").attr("x", d.x0 + 6).attr("dy", 0).text(name);
          text
            .append("tspan")
            .attr("x", d.x0 + 6)
            .attr("dy", 14)
            .attr("font-size", 10.5)
            .attr("font-weight", 650)
            .text(formatPercent(d.value));
          return;
        }
        if (w > 50 && h > 24) {
          text.append("tspan").attr("x", d.x0 + 5).attr("dy", 0).text(formatPercent(d.value));
        }
      });

    merged
      .on("mousemove", (event, d) => {
        let html = `<strong>${d.data.name}</strong><br/>ACWI share: ${formatPercent(d.value)}`;
        const sectors = Object.entries(d.data.sectors || {})
          .filter(([, value]) => Number(value) > 0)
          .sort((a, b) => b[1] - a[1]);
        if (sectors.length) {
          html += '<br/><span class="treemap-tooltip__section">Sectors</span><ul>';
          for (const [sector, value] of sectors) {
            html += `<li>${sector}: ${formatNumber(value)}%</li>`;
          }
          html += "</ul>";
        }
        tooltip
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY + 10}px`)
          .style("display", "block")
          .html(html);
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

  function formatPercent(v) {
    if (v == null) return "—";
    return d3.format(".2%")(v);
  }

  function formatNumber(v) {
    if (v == null) return "—";
    return d3.format(".2f")(v);
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

  function fitName(name, width, fontSize) {
    const label = String(name || "");
    const available = width - 12;
    const estimated = label.length * fontSize * 0.58;
    if (estimated <= available) return label;
    const words = label.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      const initials = words.map((word) => word[0]).join("");
      if (initials.length * fontSize * 0.7 <= available) return initials;
    }
    return "";
  }

  return {
    renderKey,
    renderYear,
    resize() {
      width = el.clientWidth - margin.left - margin.right;
      svg.attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);
      renderKey(currentKey);
    },
  };
}

export function mapSectorName(raw) {
  if (!raw) return "Other";
  const s = raw.trim().toLowerCase();
  if (s.includes("it") || s.includes("information")) return "Information Technology";
  if (s.includes("financial") || s.includes("bank")) return "Financials";
  if (s.includes("zykl") || s.includes("consum") && s.includes("zykl")) return "Consumer Discretionary";
  if (s.includes("nichtzykl") || s.includes("staples") || s.includes("staples")) return "Consumer Staples";
  if (s.includes("gesundheit") || s.includes("health")) return "Health Care";
  if (s.includes("industrie") || s.includes("industr")) return "Industrials";
  if (s.includes("energie") || s.includes("energy")) return "Energy";
  if (s.includes("material") || s.includes("materials")) return "Materials";
  if (s.includes("kommunikation") || s.includes("communication") || s.includes("telecom")) return "Communication Services";
  if (s.includes("immobilien") || s.includes("realestate") || s.includes("real estate")) return "Real Estate";
  if (s.includes("versorg") || s.includes("utility") || s.includes("utilities")) return "Utilities";
  return raw;
}
