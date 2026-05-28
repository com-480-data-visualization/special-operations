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
 * @param {"top" | "treemap" | undefined} focus Target chart family.
 */
export function setStageFocus(stage, treemapPanel, focus) {
  if (!(stage instanceof HTMLElement)) return;
  if (focus === "treemap" && treemapPanel instanceof HTMLElement) {
    stage.scrollTo({ top: Math.max(0, treemapPanel.offsetTop - 12), behavior: "smooth" });
    return;
  }
  stage.scrollTo({ top: 0, behavior: "smooth" });
}
