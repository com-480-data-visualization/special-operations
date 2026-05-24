import * as d3 from "d3";

const DEFAULT_RADIUS = 240;
const DEFAULT_MARGIN = 152;
const DEFAULT_MAX_VALUE = 8;
const DEFAULT_GRID_LEVELS = [1, 2, 4, 6, 8];

/**
 * Creates reusable spider plot. Axis count comes from `axes`.
 *
 * @param {HTMLElement} container Element that receives SVG.
 * @param {object} options Plot options.
 * @returns {{ update: (profiles: object[]) => void, setAxes: (axes: string[]) => void }}
 */
export function createSpiderPlot(container, options) {
  const radius = options.radius ?? DEFAULT_RADIUS;
  const margin = options.margin ?? DEFAULT_MARGIN;
  const maxValue = options.maxValue ?? DEFAULT_MAX_VALUE;
  const gridLevels = options.gridLevels ?? DEFAULT_GRID_LEVELS;
  const svgSize = (radius + margin) * 2;
  const rScale = d3.scaleLinear().domain([0, maxValue]).range([0, radius]);

  let axes = normalizeAxes(options.axes);

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${svgSize} ${svgSize}`)
    .attr("role", "img")
    .attr("aria-label", options.ariaLabel ?? "Spider chart");

  const root = svg
    .append("g")
    .attr("transform", `translate(${svgSize / 2},${svgSize / 2})`);

  const gridLayer = root.append("g").attr("class", "spider-grid");
  const axisLayer = root.append("g").attr("class", "spider-axes");
  const dataLayer = root.append("g").attr("class", "spider-data");
  const legendLayer = svg
    .append("g")
    .attr("class", "spider-profile-legend")
    .attr("transform", `translate(28, ${svgSize - 78})`);

  renderScaffold();

  function setAxes(nextAxes) {
    axes = normalizeAxes(nextAxes);
    renderScaffold();
  }

  function renderScaffold() {
    gridLayer.selectAll("*").remove();
    axisLayer.selectAll("*").remove();
    renderGrid(gridLayer, rScale, axes, gridLevels);
    renderAxes(axisLayer, axes, radius);
  }

  function update(profiles) {
    const renderProfiles = profiles.map((profile) =>
      buildRenderableProfile(profile, axes, rScale, maxValue),
    );
    renderLegend(legendLayer, renderProfiles);

    const groups = dataLayer
      .selectAll("g.spider-profile")
      .data(renderProfiles, (profile) => profile.id);

    const entered = groups.enter().append("g").attr("class", "spider-profile");
    entered.append("polygon").attr("class", "spider-area");
    entered.append("g").attr("class", "spider-segments");
    entered.append("g").attr("class", "spider-dots");

    const merged = entered.merge(groups);

    merged.each(function renderProfile(profile) {
      const group = d3.select(this);

      group
        .select("polygon")
        .transition()
        .duration(450)
        .attr("points", profile.polygonPoints)
        .attr("fill", `${profile.color}26`)
        .attr("stroke", "none")
        .attr("opacity", profile.isClosed ? 1 : 0);

      group
        .select("g.spider-segments")
        .selectAll("line")
        .data(profile.segments, (segment) => segment.id)
        .join("line")
        .attr("x1", (segment) => segment.x1)
        .attr("y1", (segment) => segment.y1)
        .attr("x2", (segment) => segment.x2)
        .attr("y2", (segment) => segment.y2)
        .attr("stroke", profile.color)
        .attr("stroke-width", 2.4)
        .attr("stroke-linecap", "round")
        .attr("stroke-dasharray", (segment) => (segment.dotted ? "6,5" : null))
        .attr("class", (segment) =>
          segment.dotted ? "spider-segment spider-segment--dotted" : "spider-segment",
        );

      group
        .select("g.spider-dots")
        .selectAll("circle")
        .data(profile.points, (point) => point.axis)
        .join("circle")
        .attr("cx", (point) => point.x)
        .attr("cy", (point) => point.y)
        .attr("r", (point) => (point.value === null ? 0 : 4.5))
        .attr("fill", profile.color)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.2)
        .attr("class", (point) =>
          point.extrapolated ? "spider-dot spider-dot--extrapolated" : "spider-dot",
        )
        .each(function addTooltip(point) {
          d3.select(this).selectAll("title").remove();
          d3.select(this)
            .append("title")
            .text(
              options.pointTooltipFormatter
                ? options.pointTooltipFormatter(profile, point)
                : `${profile.label} ${point.axis}: ${point.value ?? "n/a"}`,
            );
        });
    });

    groups.exit().remove();
  }

  return { update, setAxes };
}

function normalizeAxes(axes) {
  return axes.map((axis) =>
    typeof axis === "string" ? { id: axis, label: axis } : axis,
  );
}

function renderLegend(layer, profiles) {
  const items = layer
    .selectAll("g")
    .data(profiles, (profile) => profile.id)
    .join("g")
    .attr("transform", (_, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      return `translate(${column * 290}, ${row * 24})`;
    });

  items
    .selectAll("line")
    .data((profile) => [profile])
    .join("line")
    .attr("x1", 0)
    .attr("x2", 28)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", (profile) => profile.color)
    .attr("stroke-width", 4)
    .attr("stroke-linecap", "round");

  items
    .selectAll("text")
    .data((profile) => [profile])
    .join("text")
    .attr("x", 38)
    .attr("y", 4)
    .attr("fill", (profile) => profile.color)
    .text((profile) => profile.label);
}

function axisAngle(index, totalAxes) {
  return (index / totalAxes) * 2 * Math.PI - Math.PI / 2;
}

function polarToXY(radius, angle) {
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

function renderGrid(layer, rScale, axes, gridLevels) {
  for (const level of gridLevels) {
    const radius = rScale(level);
    const points = axes.map((_, index) =>
      polarToXY(radius, axisAngle(index, axes.length)),
    );

    layer
      .append("polygon")
      .attr("points", points.map((point) => point.join(",")).join(" "))
      .attr("fill", "none")
      .attr("stroke", level === 1 ? "#e7ebf555" : "#ffffff1a")
      .attr("stroke-width", level === 1 ? 1.5 : 1)
      .attr("stroke-dasharray", level === 1 ? "5,4" : "none");

    layer
      .append("text")
      .attr("x", 8)
      .attr("y", -radius + 4)
      .attr("fill", "#8f98aa")
      .attr("font-size", 11)
      .text(level === 1 ? "2000 baseline" : `${level}x`);
  }
}

function renderAxes(layer, axes, radius) {
  axes.forEach((axis, index) => {
    const angle = axisAngle(index, axes.length);
    const [x, y] = polarToXY(radius, angle);
    const [labelX, labelY] = polarToXY(radius + 42, angle);
    const anchor =
      Math.abs(Math.cos(angle)) < 0.15
        ? "middle"
        : Math.cos(angle) > 0
          ? "start"
          : "end";

    layer
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", x)
      .attr("y2", y);

    layer
      .append("text")
      .attr("x", labelX)
      .attr("y", labelY)
      .attr("dy", "0.35em")
      .attr("text-anchor", anchor)
      .text(axis.label);
  });
}

function buildRenderableProfile(profile, axes, rScale, maxValue) {
  const points = axes.map((axis, index) => {
    const rawPoint = profile.points[index] ?? null;
    const value = rawPoint?.value ?? null;
    const clamped = value === null ? null : Math.min(value, maxValue);
    const [x, y] = polarToXY(
      rScale(clamped ?? 0),
      axisAngle(index, axes.length),
    );

    return {
      axis: axis.id,
      label: axis.label,
      value,
      clampedValue: clamped,
      extrapolated: Boolean(rawPoint?.extrapolated),
      fitModel: rawPoint?.fitModel ?? null,
      x,
      y,
    };
  });

  const segments = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current.value === null || next.value === null) continue;

    segments.push({
      id: `${current.axis}->${next.axis}`,
      x1: current.x,
      y1: current.y,
      x2: next.x,
      y2: next.y,
      dotted: current.extrapolated || next.extrapolated,
    });
  }

  return {
    id: profile.id,
    label: profile.label,
    color: profile.color,
    points,
    segments,
    isClosed: points.every((point) => point.value !== null),
    polygonPoints: points.map((point) => [point.x, point.y].join(",")).join(" "),
  };
}
