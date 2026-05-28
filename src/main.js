/**
 * Application entry point for the data story: linked economic views, timeline
 * controls, country and region selection, and ACWI market-composition treemaps.
 */

import "./style.css";
import "./story.css";
import * as d3 from "d3";
/*
 * Candidate analysis modules from the previous broader draft are retained in
 * the codebase but paused while the final milestone story foregrounds the
 * guided evidence stage.
import { renderAnalysisLab } from "./analysis-lab.js";
 */
import {
  DEFAULT_SELECTION,
  REGION_ORDER,
  SPIDER_AXIS_ORDER,
  buildComparisonProfiles,
  getCountryLabel,
  getYearIndex,
  hasAbsoluteMetric,
} from "./data-model.js";
/*
import { renderEcbHouseholdAnalysis } from "./ecb-household-analysis.js";
 */
import { createEvolutionChart } from "./evolution-chart.js";
/*
import { renderInequalityAddon } from "./inequality-addon.js";
import { createNormalizationExplorer } from "./normalization-explorer.js";
import { renderPost2008Analysis } from "./post-2008-analysis.js";
 */
import { createNormalizationExplorer } from "./normalization-explorer.js";
import { renderBreakFinderAnalysis } from "./post-2008-analysis.js";
import { createIndicatorMap } from "./regional-map.js";
import { createSpiderChart } from "./spider.js";
/*
import { renderThreePartStory } from "./three-part-story.js";
 */
import { createStoryController } from "./story-controller.js";
import { DEFAULT_STORY_PRESET_ID, STORY_PRESETS } from "./story-presets.js";
import {
  clampYear,
  getTreemapSnapshotIndex,
  getValidCountries,
  getValidRegions,
  setStageFocus,
  setVisibleStageSteps,
} from "./story-state.js";
import { createSectorTreemap, createTreemap } from "./treemap.js";

const ANIMATION_MS = 650;
const DEFAULT_REGIONS = [...REGION_ORDER];

/**
 * Loads data, wires controls, and renders the first view.
 *
 * @returns {Promise<void>} Resolves after initial render.
 */
async function main() {
  const data = await d3.json("./spider_data.json");
  if (!data) throw new Error("Unable to load spider_data.json");

  const indicatorSelect = getRequiredElement("indicator-select");
  const yearSlider = getRequiredElement("year-slider");
  const yearLabel = getRequiredElement("year-label");
  const playButton = getRequiredElement("play-button");
  const mapModeButton = getRequiredElement("map-mode");
  const scatterModeButton = getRequiredElement("scatter-mode");
  const countryModeButton = getRequiredElement("country-mode");
  const regionModeButton = getRequiredElement("region-mode");
  const growthModeButton = getRequiredElement("growth-mode");
  const absoluteModeButton = getRequiredElement("absolute-mode");
  const toggleSpiderButton = getRequiredElement("toggle-spider");
  const closeSpiderButton = getRequiredElement("close-spider");
  const resetSelectionButton = getRequiredElement("reset-selection");
  const selectedSummary = getRequiredElement("selected-summary");
  const mapContainer = getRequiredElement("map-chart");
  const storyEvidenceCallout = getRequiredElement("story-evidence-callout");
  const spiderPanel = getRequiredElement("spider-panel");
  const spiderCaption = getRequiredElement("spider-caption");
  const spiderContainer = getRequiredElement("spider-chart");
  const evolutionTitle = getRequiredElement("evolution-title");
  const evolutionContainer = getRequiredElement("evolution-chart");
  const treemapSlider = getRequiredElement("treemap-slider");
  const treemapDateLabel = getRequiredElement("treemap-date-label");
  const storyStage = document.querySelector(".story-stage");
  const treemapPanel = document.querySelector(".treemap-panel");

  let selectedIso3 = DEFAULT_SELECTION.filter((iso3) => iso3 in data.countries);
  let selectedRegions = [...DEFAULT_REGIONS];
  let viewMode = "map";
  let selectionMode = "countries";
  let valueMode = "growth";
  let mapFocus = "world";
  let isPlaying = false;
  let animationId = 0;
  let activeStoryPresetId = DEFAULT_STORY_PRESET_ID;

  populateIndicatorSelect(indicatorSelect, data);
  yearSlider.min = String(data.baselineYear);
  yearSlider.max = String(data.latestYear);
  yearSlider.value = String(data.latestYear);
  updateRangeProgress(yearSlider);
  yearSlider.addEventListener("input", () => updateRangeProgress(yearSlider));

  const updateMap = createIndicatorMap(mapContainer, data, toggleCountry, toggleRegion);
  const spiderAxes = SPIDER_AXIS_ORDER.filter((axis) => data.axes.includes(axis));
  const spiderChart = createSpiderChart(spiderContainer, data, {
    axes: spiderAxes,
  });
  const updateEvolution = createEvolutionChart(evolutionContainer, data);
  const analysisData = await d3.json("./analysis_lab_data.json");
  if (analysisData?.breakFinder) {
    renderBreakFinderAnalysis(
      analysisData.breakFinder,
      getRequiredElement("analysis-break-finder"),
    );
  }
  createNormalizationExplorer(getRequiredElement("normalization-explorer"), data);
  /*
   * Previous candidate analysis views are commented out in index.html and kept
   * here for easy restoration if the team wants a longer appendix after the
   * final presentation version.
  renderPost2008Analysis(data);
  await renderEcbHouseholdAnalysis();
  await renderInequalityAddon(data);
  await renderThreePartStory(document.getElementById("three-part-story"));
  createNormalizationExplorer(document.getElementById("normalization-explorer"), data);
  await renderAnalysisLab(document.getElementById("analysis-lab"));
   */

  let treemap = null;
  let sectorTreemap = null;
  let treemapData = null;
  let treemapSnapshots = [];
  try {
    treemapData = await d3.json("./treemap_data.json");
    const treemapContainer = getRequiredElement("treemap-chart");
    const sectorTreemapContainer = getRequiredElement("sector-treemap-chart");
    treemap = createTreemap(treemapContainer, treemapData);
    sectorTreemap = createSectorTreemap(sectorTreemapContainer, treemapData);
    treemapSnapshots = (treemapData.snapshots || [])
      .slice()
      .sort((a, b) => a.key.localeCompare(b.key));
    treemapSlider.min = "0";
    treemapSlider.max = String(Math.max(0, treemapSnapshots.length - 1));
    treemapSlider.value = String(Math.max(0, treemapSnapshots.length - 1));
    treemapSlider.disabled = treemapSnapshots.length <= 1;
    updateRangeProgress(treemapSlider);
  } catch (e) {
    console.warn("treemap_data.json not found or failed to load:", e);
    treemapSlider.disabled = true;
  }

  /**
   * Adds or removes one country from the comparison set.
   *
   * @param {string} iso3 ISO-3 country code.
   */
  function toggleCountry(iso3) {
    if (selectedIso3.includes(iso3)) {
      if (selectedIso3.length === 1) return;
      selectedIso3 = selectedIso3.filter((selected) => selected !== iso3);
    } else if (selectedIso3.length >= 5) {
      selectedIso3 = [...selectedIso3.slice(1), iso3];
    } else {
      selectedIso3 = [...selectedIso3, iso3];
    }
    render();
  }

  /**
   * Adds or removes one region from the comparison set.
   *
   * @param {string} region Region name.
   */
  function toggleRegion(region) {
    if (selectedRegions.includes(region)) {
      if (selectedRegions.length === 1) return;
      selectedRegions = selectedRegions.filter((selected) => selected !== region);
    } else {
      selectedRegions = [...selectedRegions, region];
    }
    render();
  }

  /**
   * Renders map, scatter, controls, and spider chart from current state.
   */
  function render() {
    const axis = indicatorSelect.value;
    const year = Number.parseInt(yearSlider.value, 10);
    const yearIndex = getYearIndex(data, year);
    const hasAbsolute = hasAbsoluteMetric(data, axis);
    if (valueMode === "absolute" && !hasAbsolute) valueMode = "growth";
    yearLabel.textContent = String(year);

    setModeButtonState(mapModeButton, viewMode === "map");
    setModeButtonState(scatterModeButton, viewMode === "scatter");
    setModeButtonState(countryModeButton, selectionMode === "countries");
    setModeButtonState(regionModeButton, selectionMode === "regions");
    setModeButtonState(growthModeButton, valueMode === "growth");
    setModeButtonState(absoluteModeButton, valueMode === "absolute");
    absoluteModeButton.disabled = !hasAbsolute;
    absoluteModeButton.title = hasAbsolute
      ? "Show absolute scale where it is meaningful."
      : "Absolute values are unavailable or not comparable for this indicator.";
    selectedSummary.textContent = buildSelectionText(
      selectedIso3,
      selectedRegions,
      selectionMode,
    );
    spiderCaption.textContent =
      selectionMode === "regions"
        ? "Click countries to select their whole region. The spider graph shows how compounded real-economy values compare with compounded market values across regional averages."
        : "Click countries on the map to compare their full compounded profiles and see where GDP diverges from ETF and market-cap values.";
    evolutionTitle.textContent =
      selectionMode === "regions"
        ? `${axis}: ${valueMode} by region`
        : `${axis}: ${valueMode} by country`;

    updateMap({
      axis,
      yearIndex,
      viewMode,
      selectedIso3,
      selectedRegions,
      selectionMode,
      valueMode,
      mapFocus,
    });
    spiderChart.update(
      buildComparisonProfiles(
        data,
        yearIndex,
        selectedIso3,
        selectedRegions,
        selectionMode,
        spiderAxes,
      ),
    );
    updateEvolution({
      axis,
      yearIndex,
      selectedIso3,
      selectedRegions,
      selectionMode,
      valueMode,
    });

    renderTreemap();
  }

  /**
   * Renders the market-structure treemap from its own 2025-to-latest timeline.
   */
  function renderTreemap() {
    if (!treemap || !treemapSnapshots.length) {
      treemapDateLabel.textContent = "No data";
      return;
    }
    const snapshotIndex = Number.parseInt(treemapSlider.value, 10);
    const snapshot = treemapSnapshots[Math.min(snapshotIndex, treemapSnapshots.length - 1)];
    treemapDateLabel.textContent = snapshot.label;
    treemap.renderKey(snapshot.key);
    sectorTreemap?.renderKey(snapshot.key);
  }

  /**
   * Applies a named story preset to all linked views.
   *
   * @param {string} presetId Story preset identifier.
   * @param {{ force?: boolean }} [options] Preset options.
   */
  function applyStoryPreset(presetId, options = {}) {
    const preset = STORY_PRESETS[presetId];
    if (!preset || (activeStoryPresetId === presetId && !options.force)) return;

    stopAnimation();
    activeStoryPresetId = presetId;
    indicatorSelect.value = data.axes.includes(preset.axis) ? preset.axis : data.axes[0];
    yearSlider.value = String(clampYear(data, preset.year ?? data.latestYear));
    updateRangeProgress(yearSlider);
    viewMode = preset.viewMode ?? viewMode;
    selectionMode = preset.selectionMode ?? selectionMode;
    valueMode = preset.valueMode ?? valueMode;
    mapFocus = preset.mapFocus ?? "world";
    selectedIso3 = getValidCountries(preset.selectedIso3, data, DEFAULT_SELECTION);
    selectedRegions = getValidRegions(preset.selectedRegions, DEFAULT_REGIONS);
    setTreemapSnapshot(preset.treemapSnapshot);
    setVisibleStageSteps(storyStage, preset.stageSteps);
    renderStoryEvidenceCallout(storyEvidenceCallout, preset.callout);
    render();
    setStageFocus(storyStage, treemapPanel, preset.stageFocus);
  }

  /**
   * Moves the ACWI treemap slider to a semantic snapshot.
   *
   * @param {"first" | "latest" | string | undefined} snapshot Target snapshot.
   */
  function setTreemapSnapshot(snapshot) {
    if (!treemapSnapshots.length || !snapshot) return;
    const snapshotIndex = getTreemapSnapshotIndex(treemapSnapshots, snapshot);
    treemapSlider.value = String(snapshotIndex);
    updateRangeProgress(treemapSlider);
  }

  /**
   * Starts or stops year-by-year animation.
   */
  function toggleAnimation() {
    isPlaying = !isPlaying;
    const label = playButton.querySelector(".play-button__label");
    if (label) label.textContent = isPlaying ? "Pause" : "Play";
    else playButton.textContent = isPlaying ? "Pause" : "Play";
    playButton.dataset.playing = String(isPlaying);
    playButton.setAttribute(
      "aria-label",
      isPlaying ? "Pause timeline" : "Play timeline",
    );
    if (isPlaying) stepAnimation();
    else window.clearTimeout(animationId);
  }

  /**
   * Stops timeline playback and restores play-button state.
   */
  function stopAnimation() {
    if (!isPlaying) return;
    isPlaying = false;
    window.clearTimeout(animationId);
    const label = playButton.querySelector(".play-button__label");
    if (label) label.textContent = "Play";
    else playButton.textContent = "Play";
    playButton.dataset.playing = "false";
    playButton.setAttribute("aria-label", "Play timeline");
  }

  /**
   * Advances the selected year while playback is active.
   */
  function stepAnimation() {
    if (!isPlaying) return;
    const currentYear = Number.parseInt(yearSlider.value, 10);
    yearSlider.value =
      currentYear >= data.latestYear
        ? String(data.baselineYear)
        : String(currentYear + 1);
    updateRangeProgress(yearSlider);
    render();
    animationId = window.setTimeout(stepAnimation, ANIMATION_MS);
  }

  indicatorSelect.addEventListener("change", render);
  yearSlider.addEventListener("input", render);
  treemapSlider.addEventListener("input", () => {
    updateRangeProgress(treemapSlider);
    renderTreemap();
  });
  window.addEventListener("resize", () => {
    treemap?.resize();
    sectorTreemap?.resize();
  });
  playButton.addEventListener("click", toggleAnimation);
  mapModeButton.addEventListener("click", () => {
    viewMode = "map";
    render();
  });
  scatterModeButton.addEventListener("click", () => {
    viewMode = "scatter";
    render();
  });
  countryModeButton.addEventListener("click", () => {
    selectionMode = "countries";
    render();
  });
  regionModeButton.addEventListener("click", () => {
    selectionMode = "regions";
    render();
  });
  growthModeButton.addEventListener("click", () => {
    valueMode = "growth";
    render();
  });
  absoluteModeButton.addEventListener("click", () => {
    if (!hasAbsoluteMetric(data, indicatorSelect.value)) return;
    valueMode = "absolute";
    render();
  });
  toggleSpiderButton.addEventListener("click", () => {
    const isHidden = toggleSpider(spiderPanel, toggleSpiderButton);
    toggleSpiderButton.textContent = isHidden ? "Show spider" : "Hide spider";
    toggleSpiderButton.setAttribute("aria-pressed", String(!isHidden));
  });
  closeSpiderButton.addEventListener("click", () => {
    spiderPanel.hidden = true;
    toggleSpiderButton.textContent = "Show spider";
    toggleSpiderButton.setAttribute("aria-pressed", "false");
  });
  resetSelectionButton.addEventListener("click", () => {
    selectedIso3 = DEFAULT_SELECTION.filter((iso3) => iso3 in data.countries);
    selectedRegions = [...DEFAULT_REGIONS];
    render();
  });

  render();
  createStoryController({ applyPreset: applyStoryPreset });
  activeStoryPresetId = "";
  applyStoryPreset(DEFAULT_STORY_PRESET_ID);
}

/**
 * Updates the CSS custom property that drives the range slider fill so the
 * filled portion of the track matches the current value on WebKit browsers.
 *
 * @param {HTMLInputElement} slider Range input element.
 */
function updateRangeProgress(slider) {
  const min = Number.parseFloat(slider.min || "0");
  const max = Number.parseFloat(slider.max || "100");
  const value = Number.parseFloat(slider.value);
  const range = max - min;
  const ratio = range > 0 ? ((value - min) / range) * 100 : 0;
  slider.style.setProperty("--range-progress", `${ratio}%`);
}

/**
 * Finds a required DOM element.
 *
 * @param {string} id Element id.
 * @returns {HTMLElement} Matching element.
 */
function getRequiredElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}

/**
 * Populates the indicator dropdown.
 *
 * @param {HTMLSelectElement} select Indicator select.
 * @param {object} data Loaded spider data.
 */
function populateIndicatorSelect(select, data) {
  for (const axis of data.axes) {
    const option = document.createElement("option");
    option.value = axis;
    option.textContent = axis;
    select.appendChild(option);
  }
  select.value = data.axes[0];
}

/**
 * Updates segmented-control state.
 *
 * @param {HTMLButtonElement} button Control button.
 * @param {boolean} isActive Whether the button is selected.
 */
function setModeButtonState(button, isActive) {
  button.dataset.active = String(isActive);
  button.setAttribute("aria-pressed", String(isActive));
}

/**
 * Updates the chart overlay with the active story claim.
 *
 * @param {HTMLElement} container Callout container.
 * @param {{ label: string, title: string, body: string, stats?: string[] } | undefined} callout Story callout copy.
 */
function renderStoryEvidenceCallout(container, callout) {
  container.replaceChildren();
  container.hidden = !callout;
  if (!callout) return;

  const label = document.createElement("p");
  label.className = "story-evidence-callout__label";
  label.textContent = callout.label;

  const title = document.createElement("h3");
  title.textContent = callout.title;

  const body = document.createElement("p");
  body.className = "story-evidence-callout__body";
  body.textContent = callout.body;

  container.append(label, title, body);

  if (!callout.stats?.length) return;
  const statList = document.createElement("div");
  statList.className = "story-evidence-callout__stats";
  for (const stat of callout.stats) {
    const badge = document.createElement("span");
    badge.textContent = stat;
    statList.append(badge);
  }
  container.append(statList);
}

/**
 * Toggles spider overlay visibility.
 *
 * @param {HTMLElement} panel Spider panel.
 * @param {HTMLButtonElement} button Toggle button.
 * @returns {boolean} Whether the panel is hidden after toggling.
 */
function toggleSpider(panel, button) {
  const isHidden = !panel.hidden;
  panel.hidden = isHidden;
  button.setAttribute("aria-pressed", String(!isHidden));
  return isHidden;
}

/**
 * Describes the active country or region selection.
 *
 * @param {string[]} selectedIso3 Selected country codes.
 * @param {string[]} selectedRegions Selected region names.
 * @param {"countries" | "regions"} selectionMode Active selection mode.
 * @returns {string} Summary text.
 */
function buildSelectionText(selectedIso3, selectedRegions, selectionMode) {
  if (selectionMode === "regions") {
    const regions = REGION_ORDER.filter((region) => selectedRegions.includes(region));
    return `Selected regions: ${regions.join(", ")}`;
  }

  return `Selected countries: ${selectedIso3.map(getCountryLabel).join(", ")}`;
}

main().catch(console.error);
