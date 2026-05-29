import { formatMultiple, getProfileFlag } from "./data-model.js";
import { createSpiderPlot } from "./spider-plot.js";

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
    dynamicScale: true,
    ariaLabel: "Spider chart comparing selected profiles",
    getProfileBadge(profile) {
      const flag = getProfileFlag(profile.id);
      return flag ? `${flag} ${profile.label}` : profile.label;
    },
    pointTooltipFormatter(profile, point) {
      const suffix = point.extrapolated ? '<div class="spider-tooltip__meta">Estimated</div>' : "";
      return `
        <div class="spider-tooltip__title">${getProfileTooltipLabel(profile)}</div>
        <div class="spider-tooltip__metric">${point.label}</div>
        <div class="spider-tooltip__value">${formatMultiple(point.value)}</div>
        ${suffix}
      `;
    },
    segmentTooltipFormatter(profile, segment) {
      const suffix = segment.dotted ? '<div class="spider-tooltip__meta">Contains estimated point</div>' : "";
      return `
        <div class="spider-tooltip__title">${getProfileTooltipLabel(profile)}</div>
        <div class="spider-tooltip__metric">${segment.fromLabel} -> ${segment.toLabel}</div>
        ${suffix}
      `;
    },
  });

  return {
    update: plot.update,
    setAxes(nextAxes) {
      plot.setAxes(nextAxes);
    },
  };
}

function getProfileTooltipLabel(profile) {
  const flag = getProfileFlag(profile.id);
  return flag ? `${flag} ${profile.label}` : profile.label;
}
