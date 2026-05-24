import { formatMultiple } from "./data-model.js";
import { createSpiderPlot } from "./spider-plot.js";

const MAX_VALUE = 8;

/**
 * Creates repo-specific spider chart adapter on top of generic spider plot.
 *
 * @param {HTMLElement} container Element that receives SVG.
 * @param {object} data Loaded spider data.
 * @param {{ axes?: string[] }} [options] Optional spider configuration.
 * @returns {{ update: (profiles: object[]) => void, setAxes: (axes: string[]) => void }}
 */
export function createSpiderChart(container, data, options = {}) {
  const axes = options.axes ?? data.axes;
  const plot = createSpiderPlot(container, {
    axes,
    maxValue: MAX_VALUE,
    ariaLabel: "Spider chart comparing selected profiles",
    pointTooltipFormatter(profile, point) {
      const suffix = point.extrapolated ? " (estimated)" : "";
      return `${profile.label} ${point.label}: ${formatMultiple(point.value)}${suffix}`;
    },
  });

  return {
    update: plot.update,
    setAxes(nextAxes) {
      plot.setAxes(nextAxes);
    },
  };
}
