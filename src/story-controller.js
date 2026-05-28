/**
 * Wires narrative story steps to chart presets. Scroll activation advances the
 * story automatically, while buttons give readers a reliable manual trigger.
 */

const ACTIVE_CLASS = "story-step--active";

/**
 * Connects story steps and preset buttons to a chart preset callback.
 *
 * @param {{ applyPreset: (presetId: string, options?: { force?: boolean }) => void }} options Controller options.
 * @returns {{ destroy: () => void }} Cleanup handle.
 */
export function createStoryController({ applyPreset }) {
  const steps = [...document.querySelectorAll("[data-story-preset]")];
  const buttons = [...document.querySelectorAll("[data-story-action]")];

  /**
   * Applies a preset and updates the active visual state.
   *
   * @param {string} presetId Preset identifier.
   * @param {{ force?: boolean }} [options] Activation options.
   */
  function activatePreset(presetId, options = {}) {
    applyPreset(presetId, options);
    const hasMatchingStep = steps.some((step) => step.dataset.storyPreset === presetId);
    if (hasMatchingStep) {
      for (const step of steps) {
        step.classList.toggle(ACTIVE_CLASS, step.dataset.storyPreset === presetId);
      }
    }
  }

  for (const button of buttons) {
    button.addEventListener("click", () =>
      activatePreset(button.dataset.storyAction, { force: true }),
    );
  }

  if (!("IntersectionObserver" in window)) {
    return { destroy() {} };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const presetId = visible?.target?.dataset?.storyPreset;
      if (presetId) activatePreset(presetId);
    },
    {
      root: null,
      rootMargin: "-28% 0px -44% 0px",
      threshold: [0.25, 0.5, 0.75],
    },
  );

  for (const step of steps) observer.observe(step);
  if (steps[0]?.dataset.storyPreset) activatePreset(steps[0].dataset.storyPreset);

  return {
    destroy() {
      observer.disconnect();
    },
  };
}
