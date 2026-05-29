/**
 * Small state helpers for applying guided-story presets without bloating the
 * main chart orchestration file.
 */

/**
 * Keeps a story preset year inside the data range.
 *
 * @param {object} data Loaded spider data.
 * @param {number} year Requested year.
 * @returns {number} Valid year.
 */
export function clampYear(data, year) {
  return Math.min(data.latestYear, Math.max(data.baselineYear, year));
}

/**
 * Filters preset country selections against loaded data.
 *
 * @param {string[] | undefined} iso3Codes Preset ISO-3 country codes.
 * @param {object} data Loaded spider data.
 * @param {string[]} fallbackSelection Fallback country selection.
 * @returns {string[]} Valid country selection.
 */
export function getValidCountries(iso3Codes, data, fallbackSelection) {
  const fallback = fallbackSelection.filter((iso3) => iso3 in data.countries);
  const selected = (iso3Codes ?? fallback).filter((iso3) => iso3 in data.countries);
  return selected.length > 0 ? selected : fallback;
}

/**
 * Filters preset region selections against known regions.
 *
 * @param {string[] | undefined} regions Preset region names.
 * @param {string[]} validRegions Known region names.
 * @returns {string[]} Valid region selection.
 */
export function getValidRegions(regions, validRegions) {
  const selected = (regions ?? validRegions).filter((region) =>
    validRegions.includes(region),
  );
  return selected.length > 0 ? selected : [...validRegions];
}

/**
 * Resolves a semantic treemap snapshot target to a slider index.
 *
 * @param {object[]} snapshots Sorted treemap snapshots.
 * @param {"first" | "latest" | string} target Snapshot target.
 * @returns {number} Slider index.
 */
export function getTreemapSnapshotIndex(snapshots, target) {
  if (target === "first") return 0;
  if (target === "latest") return Math.max(0, snapshots.length - 1);

  const index = snapshots.findIndex(
    (snapshot) => snapshot.key === target || String(snapshot.year) === target,
  );
  return index >= 0 ? index : Math.max(0, snapshots.length - 1);
}

/**
 * Scrolls the reusable evidence stage to the relevant chart family.
 *
 * @param {Element | null} stage Scrollable story stage.
 * @param {Element | null} treemapPanel Treemap section inside the stage.
 * @param {"top" | "treemap" | string | undefined} focus Target chart family.
 */
export function setStageFocus(stage, treemapPanel, focus) {
  if (!(stage instanceof HTMLElement)) return;
  const target = getStageFocusTarget(stage, treemapPanel, focus);
  if (target) {
    stage.scrollTo({
      top: Math.max(0, target.offsetTop - getStageHeaderOffset(stage)),
      behavior: "smooth",
    });
    return;
  }
  stage.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Shows only the evidence charts relevant to the active story act.
 *
 * @param {Element | null} stage Scrollable story stage.
 * @param {string[] | undefined} visibleStepIds Evidence step IDs to show.
 */
export function setVisibleStageSteps(stage, visibleStepIds) {
  if (!(stage instanceof HTMLElement)) return;
  const allowed = new Set(visibleStepIds?.length ? visibleStepIds : ["stage-map"]);
  const steps = [...stage.querySelectorAll("[data-stage-step]")];
  const buttons = [...stage.querySelectorAll("[data-stage-jump]")];

  for (const step of steps) {
    const isVisible = allowed.has(step.dataset.stageStep);
    step.hidden = !isVisible;
    if (!isVisible) step.classList.remove("evidence-step--active");
  }

  for (const button of buttons) {
    const isVisible = allowed.has(button.dataset.stageJump);
    button.hidden = !isVisible;
    if (!isVisible) button.dataset.active = "false";
  }

  const firstVisibleStep = steps.find((step) => !step.hidden);
  if (!firstVisibleStep) return;
  for (const step of steps) {
    step.classList.toggle("evidence-step--active", step === firstVisibleStep);
  }
  for (const button of buttons) {
    button.dataset.active = String(button.dataset.stageJump === firstVisibleStep.dataset.stageStep);
  }
}

/**
 * Resolves a semantic stage focus to a concrete section.
 *
 * @param {HTMLElement} stage Scrollable evidence stage.
 * @param {Element | null} treemapPanel Treemap section.
 * @param {"top" | "treemap" | string | undefined} focus Target chart family.
 * @returns {HTMLElement | null} Target section.
 */
function getStageFocusTarget(stage, treemapPanel, focus) {
  if (focus === "treemap") return treemapPanel instanceof HTMLElement ? treemapPanel : null;
  if (focus && focus !== "top") {
    const directTarget = stage.querySelector(`#${CSS.escape(focus)}`);
    if (directTarget instanceof HTMLElement && !directTarget.hidden) return directTarget;
  }
  const firstVisible = stage.querySelector("[data-stage-step]:not([hidden])");
  return firstVisible instanceof HTMLElement ? firstVisible : null;
}

/**
 * Measures the sticky right-panel header so preset jumps land below it.
 *
 * @param {Element} stage Scrollable evidence stage.
 * @returns {number} Pixel offset for guided jumps.
 */
function getStageHeaderOffset(stage) {
  const header = stage.querySelector(".section-kicker--panel");
  if (!(header instanceof HTMLElement)) return 18;
  return header.offsetHeight + 28;
}
