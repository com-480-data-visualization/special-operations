/**
 * D3 spider chart comparing selected countries or region averages across
 * normalized economic axes.
 */

import * as d3 from "d3";
import { formatMultiple } from "./data-model.js";

const RADIUS = 240;
const MARGIN = 152;
const SVG_SIZE = (RADIUS + MARGIN) * 2;
const MAX_VALUE = 8;
const GRID_LEVELS = [1, 2, 4, 6, 8];

/**
 * Creates the spider chart and returns an update function.
 *
 * @param {HTMLElement} container Element that receives the SVG.
 * @param {object} data Loaded spider data.
 * @returns {(profiles: object[]) => void} Update function.
 */
export function createSpiderChart(container, data) {
  const rScale = d3.scaleLinear().domain([0, MAX_VALUE]).range([0, RADIUS]);
  const axes = data.axes;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${SVG_SIZE} ${SVG_SIZE}`)
    .attr("role", "img")
    .attr("aria-label", "Spider chart comparing selected profiles");

  const root = svg
    .append("g")
    .attr("transform", `translate(${SVG_SIZE / 2},${SVG_SIZE / 2})`);

  renderGrid(root, rScale, axes);
  renderAxes(root, axes);

  const dataLayer = root.append("g").attr("class", "spider-data");
  const legendLayer = svg
    .append("g")
    .attr("class", "spider-profile-legend")
    .attr("transform", `translate(28, ${SVG_SIZE - 78})`);

  /**
   * Updates profile polygons for the active year.
   *
   * @param {object[]} profiles Selected country or region profiles.
   */
  function update(profiles) {
    const chartProfiles = profiles.map((profile) => buildProfile(data, profile, rScale));
    renderLegend(legendLayer, chartProfiles);

    const groups = dataLayer
      .selectAll("g.spider-profile")
      .data(chartProfiles, (profile) => profile.id);

    const entered = groups.enter().append("g").attr("class", "spider-profile");
    entered.append("polygon").attr("class", "spider-area");
    entered.append("g").attr("class", "spider-dots");

    const merged = entered.merge(groups);

    merged.each(function renderProfile(profile) {
      const group = d3.select(this);
      const points = profile.points.map((point) => point.join(",")).join(" ");
      group
        .select("polygon")
        .transition()
        .duration(450)
        .attr("points", points)
        .attr("fill", `${profile.color}26`)
        .attr("stroke", profile.color)
        .attr("stroke-width", 2.4);

      const dots = profile.values.map((value, axisIndex) => ({
        axis: axes[axisIndex],
        value,
        x: profile.points[axisIndex][0],
        y: profile.points[axisIndex][1],
      }));

      group
        .select("g.spider-dots")
        .selectAll("circle")
        .data(dots)
        .join("circle")
        .attr("cx", (dot) => dot.x)
        .attr("cy", (dot) => dot.y)
        .attr("r", (dot) => (dot.value === null ? 0 : 4.5))
        .attr("fill", profile.color)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.2)
        .each(function addTooltip(dot) {
          d3.select(this).selectAll("title").remove();
          d3.select(this)
            .append("title")
            .text(`${profile.label} ${dot.axis}: ${formatMultiple(dot.value)}`);
        });

      group.select("text").remove();
    });

    groups.exit().remove();
  }

  return update;
}

/**
 * Draws a compact legend so profile names do not overlap the polygons.
 *
 * @param {d3.Selection} layer Legend layer.
 * @param {object[]} profiles Renderable profiles.
 */
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

/**
 * Returns a polar angle for one axis.
 *
 * @param {number} index Axis index.
 * @param {number} totalAxes Number of axes.
 * @returns {number} Angle in radians.
 */
function axisAngle(index, totalAxes) {
  return (index / totalAxes) * 2 * Math.PI - Math.PI / 2;
}

/**
 * Converts polar chart coordinates to SVG x/y coordinates.
 *
 * @param {number} radius Radius in pixels.
 * @param {number} angle Angle in radians.
 * @returns {[number, number]} SVG position.
 */
function polarToXY(radius, angle) {
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

/**
 * Draws spider-chart rings and baseline labels.
 *
 * @param {d3.Selection} root Root SVG group.
 * @param {d3.ScaleLinear} rScale Radius scale.
 * @param {string[]} axes Axis labels.
 */
function renderGrid(root, rScale, axes) {
  const grid = root.append("g").attr("class", "spider-grid");

  for (const level of GRID_LEVELS) {
    const radius = rScale(level);
    const points = axes.map((_, index) =>
      polarToXY(radius, axisAngle(index, axes.length)),
    );

    grid
      .append("polygon")
      .attr("points", points.map((point) => point.join(",")).join(" "))
      .attr("fill", "none")
      .attr("stroke", level === 1 ? "#e7ebf555" : "#ffffff1a")
      .attr("stroke-width", level === 1 ? 1.5 : 1)
      .attr("stroke-dasharray", level === 1 ? "5,4" : "none");

    grid
      .append("text")
      .attr("x", 8)
      .attr("y", -radius + 4)
      .attr("fill", "#8f98aa")
      .attr("font-size", 11)
      .text(level === 1 ? "2000 baseline" : `${level}x`);
  }
}

/**
 * Draws axis spokes and metric labels.
 *
 * @param {d3.Selection} root Root SVG group.
 * @param {string[]} axes Axis labels.
 */
function renderAxes(root, axes) {
  const axisGroup = root.append("g").attr("class", "spider-axes");

  axes.forEach((axis, index) => {
    const angle = axisAngle(index, axes.length);
    const [x, y] = polarToXY(RADIUS, angle);
    const [labelX, labelY] = polarToXY(RADIUS + 42, angle);
    const anchor =
      Math.abs(Math.cos(angle)) < 0.15
        ? "middle"
        : Math.cos(angle) > 0
          ? "start"
          : "end";

    axisGroup
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", x)
      .attr("y2", y);

    axisGroup
      .append("text")
      .attr("x", labelX)
      .attr("y", labelY)
      .attr("dy", "0.35em")
      .attr("text-anchor", anchor)
      .text(axis);
  });
}

/**
 * Builds one profile for the current year.
 *
 * @param {object} data Loaded spider data.
 * @param {object} profile Country or region profile.
 * @param {d3.ScaleLinear} rScale Radius scale.
 * @returns {object} Renderable profile.
 */
function buildProfile(data, profile, rScale) {
  const values = profile.values.map((value) =>
    value === null ? null : Math.min(value, MAX_VALUE),
  );
  const points = values.map((value, index) =>
    polarToXY(rScale(value ?? 0), axisAngle(index, data.axes.length)),
  );

  return {
    id: profile.id,
    label: profile.label,
    color: profile.color,
    values,
    points,
  };
}
