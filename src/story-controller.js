/**
 * Wires narrative story steps to chart presets. Scroll activation advances the
 * story automatically, while buttons give readers a reliable manual trigger.
 */

const ACTIVE_CLASS = "story-step--active";
const STAGE_ACTIVE_CLASS = "evidence-step--active";

/**
 * Connects story steps and preset buttons to a chart preset callback.
 *
 * @param {{ applyPreset: (presetId: string, options?: { force?: boolean }) => void }} options Controller options.
 * @returns {{ destroy: () => void }} Cleanup handle.
 */
export function createStoryController({ applyPreset }) {
  const steps = [...document.querySelectorAll("[data-story-preset]")];
  const buttons = [...document.querySelectorAll("[data-story-action]")];
  const stage = document.querySelector(".story-stage");
  const stageSteps = [...document.querySelectorAll("[data-stage-step]")];
  const stageJumpButtons = [...document.querySelectorAll("[data-stage-jump]")];

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

  for (const button of stageJumpButtons) {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.stageJump);
      if (target instanceof HTMLElement && stage instanceof HTMLElement) {
        stage.scrollTo({
          top: Math.max(0, target.offsetTop - getStageHeaderOffset(stage)),
          behavior: "smooth",
        });
      }
    });
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

  const stageObserver =
    stage instanceof HTMLElement
      ? new IntersectionObserver(
          (entries) => {
            const visible = entries
              .filter((entry) => entry.isIntersecting)
              .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            const stepId = visible?.target?.dataset?.stageStep;
            if (!stepId) return;
            for (const step of stageSteps) {
              step.classList.toggle(STAGE_ACTIVE_CLASS, step.dataset.stageStep === stepId);
            }
            for (const button of stageJumpButtons) {
              button.dataset.active = String(button.dataset.stageJump === stepId);
            }
          },
          {
            root: stage,
            rootMargin: "-18% 0px -44% 0px",
            threshold: [0.18, 0.35, 0.55],
          },
        )
      : null;

  for (const step of steps) observer.observe(step);
  if (steps[0]?.dataset.storyPreset) activatePreset(steps[0].dataset.storyPreset);
  for (const step of stageSteps) stageObserver?.observe(step);
  if (stageSteps[0]?.dataset.stageStep) {
    stageSteps[0].classList.add(STAGE_ACTIVE_CLASS);
    for (const button of stageJumpButtons) {
      button.dataset.active = String(button.dataset.stageJump === stageSteps[0].dataset.stageStep);
    }
  }

  return {
    destroy() {
      observer.disconnect();
      stageObserver?.disconnect();
    },
  };
}

/**
 * Measures the sticky right-panel header so scroll jumps do not hide graphs
 * underneath it.
 *
 * @param {Element} stage Scrollable evidence stage.
 * @returns {number} Pixel offset to keep above a jump target.
 */
function getStageHeaderOffset(stage) {
  const header = stage.querySelector(".section-kicker--panel");
  if (!(header instanceof HTMLElement)) return 160;
  return header.offsetHeight + 28;
}
