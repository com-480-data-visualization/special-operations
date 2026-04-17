import * as d3 from "d3";

export interface CountryData {
  name: string;
  etf: string;
  timeseries: Record<string, (number | null)[]>;
}

export interface SpiderData {
  baselineYear: number;
  latestYear: number;
  years: number[];
  axes: string[];
  mcExcluded: string[];
  countries: Record<string, CountryData>;
}

// Visual constants
const RADIUS = 220;
const MARGIN = 140;
const SVG_SIZE = (RADIUS + MARGIN) * 2;
const MAX_VALUE = 8; // axes go from 0 to 8×
const GRID_LEVELS = [1, 2, 4, 6, 8];

// Color palette – index reserved for future multi-country overlays
export const COUNTRY_COLORS = [
  "#4f6ef7",
  "#e05c5c",
  "#2bab82",
  "#f5a623",
  "#9b59b6",
];

function axisAngle(i: number, n: number) {
  return (i / n) * 2 * Math.PI - Math.PI / 2;
}

function polarToXY(r: number, angle: number): [number, number] {
  return [r * Math.cos(angle), r * Math.sin(angle)];
}

export function createSpiderChart(
  container: HTMLElement,
  data: SpiderData
): (iso3: string, yearIndex: number) => void {
  const rScale = d3.scaleLinear().domain([0, MAX_VALUE]).range([0, RADIUS]);
  const axes = data.axes;
  const n = axes.length;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${SVG_SIZE} ${SVG_SIZE}`)
    .attr("width", SVG_SIZE)
    .attr("height", SVG_SIZE);

  const g = svg
    .append("g")
    .attr("transform", `translate(${SVG_SIZE / 2},${SVG_SIZE / 2})`);

  // ── Grid rings ─────────────────────────────────────────────────────────────
  const gridGroup = g.append("g").attr("class", "grid");

  for (const level of GRID_LEVELS) {
    const r = rScale(level);
    const points = axes.map((_, i) => polarToXY(r, axisAngle(i, n)));
    gridGroup
      .append("polygon")
      .attr("points", points.map((p) => p.join(",")).join(" "))
      .attr("fill", "none")
      .attr("stroke", level === 1 ? "#555" : "#333")
      .attr("stroke-width", level === 1 ? 1.5 : 0.8)
      .attr("stroke-dasharray", level === 1 ? "5,3" : "none");

    gridGroup
      .append("text")
      .attr("x", 5)
      .attr("y", -r + 4)
      .attr("fill", "gray")
      .attr("font-size", "11px")
      .text(level === 1 ? "baseline" : `${level}×`);
  }

  // ── Axis lines & labels ────────────────────────────────────────────────────
  const axisGroup = g.append("g").attr("class", "axes");

  for (let i = 0; i < n; i++) {
    const angle = axisAngle(i, n);
    const [x, y] = polarToXY(RADIUS, angle);

    axisGroup
      .append("line")
      .attr("x1", 0).attr("y1", 0)
      .attr("x2", x).attr("y2", y)
      .attr("stroke", "#444")
      .attr("stroke-width", 1);

    const [lx, ly] = polarToXY(RADIUS + 35, angle);
    const anchor =
      Math.abs(Math.cos(angle)) < 0.15
        ? "middle"
        : Math.cos(angle) > 0 ? "start" : "end";

    axisGroup
      .append("text")
      .attr("x", lx).attr("y", ly)
      .attr("dy", "0.35em")
      .attr("text-anchor", anchor)
      .attr("fill", "#bbb")
      .attr("font-size", "13px")
      .attr("font-weight", "600")
      .text(axes[i]);
  }

  // ── Data layer ─────────────────────────────────────────────────────────────
  const dataGroup = g.append("g").attr("class", "data");
  const slot = dataGroup.append("g").attr("class", "country-slot");

  // Solid fill polygon (for axes with data)
  const areaPath = slot
    .append("polygon")
    .attr("class", "country-area")
    .attr("fill", COUNTRY_COLORS[0] + "40")
    .attr("stroke", COUNTRY_COLORS[0])
    .attr("stroke-width", 2.5)
    .attr("stroke-linejoin", "round");

  // Dashed overlay for null/excluded axes (goes to center)
  const nullPath = slot
    .append("polygon")
    .attr("class", "country-area-null")
    .attr("fill", "none")
    .attr("stroke", COUNTRY_COLORS[0] + "60")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "4,4")
    .attr("stroke-linejoin", "round");

  const dotGroup = slot.append("g").attr("class", "country-dots");

  // ── Update function ────────────────────────────────────────────────────────
  function update(iso3: string, yearIndex: number) {
    const country = data.countries[iso3];
    if (!country) return;

    const rawValues: (number | null)[] = axes.map((axis) => {
      const ts = country.timeseries[axis];
      if (!ts) return null;
      const raw = yearIndex < ts.length ? ts[yearIndex] : null;
      return raw !== null && raw !== undefined ? Math.min(raw, MAX_VALUE) : null;
    });

    // Points for available data (null → stays at baseline = rScale(1) to avoid collapse to 0)
    const hasData = rawValues.map((v) => v !== null);
    const effectiveValues = rawValues.map((v) => (v !== null ? v : 0));

    const solidPoints = effectiveValues.map((val, i) =>
      polarToXY(rScale(val), axisAngle(i, n))
    );
    const nullPoints = effectiveValues.map((val, i) =>
      hasData[i] ? polarToXY(rScale(val), axisAngle(i, n)) : [0, 0] as [number, number]
    );

    areaPath.attr("points", solidPoints.map((p) => p.join(",")).join(" "));

    // Only show dashed null overlay if there are any missing axes
    const anyNull = rawValues.some((v) => v === null);
    nullPath.attr("visibility", anyNull ? "visible" : "hidden");
    if (anyNull) {
      nullPath.attr("points", nullPoints.map((p) => p.join(",")).join(" "));
    }

    // Dots
    dotGroup.selectAll<SVGCircleElement, number>("circle")
      .data(rawValues)
      .join("circle")
      .attr("cx", (_, i) => solidPoints[i][0])
      .attr("cy", (_, i) => solidPoints[i][1])
      .attr("r", (v) => (v !== null ? 5 : 0))
      .attr("fill", COUNTRY_COLORS[0])
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .each(function (val, i) {
        d3.select(this).selectAll("title").remove();
        d3.select(this)
          .append("title")
          .text(
            val !== null
              ? `${axes[i]}: ${val.toFixed(2)}×`
              : `${axes[i]}: no data`
          );
      });
  }

  return update;
}

