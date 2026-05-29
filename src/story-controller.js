/**
 * Wires narrative story steps to chart presets. Scroll activation advances the
 * story automatically, while buttons give readers a reliable manual trigger.
 */

const ACTIVE_CLASS = "story-step--active";
const STAGE_ACTIVE_CLASS = "evidence-step--active";
const STORY_TRIGGER_RATIO = 0.7;

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
  let activeScrollPresetId = "";
  let scrollFrame = 0;

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
    syncActiveStoryStep();
    window.addEventListener("scroll", queueStorySync, { passive: true });
    window.addEventListener("resize", queueStorySync);
    return {
      destroy() {
        if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
        window.removeEventListener("scroll", queueStorySync);
        window.removeEventListener("resize", queueStorySync);
      },
    };
  }

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

  if (steps[0]?.dataset.storyPreset) activatePreset(steps[0].dataset.storyPreset);
  syncActiveStoryStep();
  window.addEventListener("scroll", queueStorySync, { passive: true });
  window.addEventListener("resize", queueStorySync);
  for (const step of stageSteps) stageObserver?.observe(step);
  if (stageSteps[0]?.dataset.stageStep) {
    stageSteps[0].classList.add(STAGE_ACTIVE_CLASS);
    for (const button of stageJumpButtons) {
      button.dataset.active = String(button.dataset.stageJump === stageSteps[0].dataset.stageStep);
    }
  }

  return {
    destroy() {
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", queueStorySync);
      window.removeEventListener("resize", queueStorySync);
      stageObserver?.disconnect();
    },
  };

  function queueStorySync() {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      syncActiveStoryStep();
    });
  }

  function syncActiveStoryStep() {
    const nextStep = getActiveStoryStep(steps);
    const presetId = nextStep?.dataset?.storyPreset;
    if (!presetId || presetId === activeScrollPresetId) return;
    activeScrollPresetId = presetId;
    activatePreset(presetId);
  }
}

/**
 * Picks the story step whose vertical span currently contains the activation
 * line. This fires when the top of a new section crosses the chosen band,
 * which behaves well even when sections are taller than the viewport.
 *
 * @param {HTMLElement[]} steps Story steps ordered in document flow.
 * @returns {HTMLElement | undefined} Active step.
 */
function getActiveStoryStep(steps) {
  const triggerY = window.innerHeight * STORY_TRIGGER_RATIO;
  let fallback = steps[0];

  for (const step of steps) {
    const rect = step.getBoundingClientRect();
    if (rect.bottom <= 0) {
      fallback = step;
      continue;
    }
    if (rect.top <= triggerY && rect.bottom > triggerY) return step;
    if (rect.top > triggerY) return fallback ?? step;
  }

  return fallback;
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
  if (!(header instanceof HTMLElement)) return 18;
  return header.offsetHeight + 28;
}
