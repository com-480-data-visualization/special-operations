/**
 * Computes and renders the ACWI concentration read: whether one country, one
 * industry, or one country-industry combination carries the index snapshot.
 */

import * as d3 from "d3";

const OTHER_BUCKET_NAME = "Other";
const formatShare = d3.format(".1%");
const formatContribution = d3.format(".1%");
const formatSignedPoint = d3.format("+.1f");

/**
 * Renders the dominance summary for the selected ACWI snapshot.
 *
 * @param {HTMLElement} container Summary container.
 * @param {object} data Treemap dataset loaded from treemap_data.json.
 * @param {string} snapshotKey Snapshot key to analyze.
 */
export function renderTreemapDominanceSummary(container, data, snapshotKey) {
  if (!container) throw new Error("Missing treemap dominance summary container");

  const summary = buildTreemapDominanceSummary(data, snapshotKey);
  container.replaceChildren();
  container.hidden = !summary;
  if (!summary) return;

  const heading = document.createElement("div");
  heading.className = "treemap-dominance__heading";

  const label = document.createElement("p");
  label.className = "treemap-dominance__label";
  label.textContent = "Focused View";

  const title = document.createElement("h3");
  title.textContent = "Does one country or industry carry the index?";

  const copy = document.createElement("p");
  copy.textContent = summary.verdict;

  heading.append(label, title, copy);

  const cards = document.createElement("div");
  cards.className = "treemap-dominance__cards";
  for (const card of buildDominanceCards(summary)) cards.append(createDominanceCard(card));

  container.append(heading, cards);
}

/**
 * Builds a normalized concentration summary for a snapshot.
 *
 * @param {object} data Treemap dataset loaded from treemap_data.json.
 * @param {string} snapshotKey Snapshot key to analyze.
 * @returns {object | null} Summary object, or null when the snapshot is empty.
 */
function buildTreemapDominanceSummary(data, snapshotKey) {
  const current = buildSnapshotStats(data, snapshotKey);
  if (!current) return null;

  const baselineKey = data?.snapshots?.[0]?.key || data?.years?.[0];
  const baseline = buildSnapshotStats(data, baselineKey);
  const baselineCountry = baseline?.namedCountries.find(
    (country) => country.name === current.topCountry.name,
  );
  const baselineSector = baseline?.sectors.find(
    (sector) => sector.name === current.topSector.name,
  );

  const topCountrySectorShare =
    Number(current.topCountry.sectors?.[current.topSector.name] || 0) / 100;
  const topCountrySectorContribution = current.topCountry.value * topCountrySectorShare;
  const topCountrySectorBucketShare =
    current.topSector.value > 0
      ? topCountrySectorContribution / current.topSector.value
      : 0;

  return {
    ...current,
    topCountryDeltaPoints: getPointDelta(current.topCountry.value, baselineCountry?.value),
    topSectorDeltaPoints: getPointDelta(current.topSector.value, baselineSector?.value),
    topCountrySectorContribution,
    topCountrySectorBucketShare,
    verdict: buildVerdict(
      current.topCountry,
      current.topSector,
      topCountrySectorContribution,
    ),
  };
}

/**
 * Calculates ranked country and sector concentration metrics for one snapshot.
 *
 * @param {object} data Treemap dataset loaded from treemap_data.json.
 * @param {string} snapshotKey Snapshot key to analyze.
 * @returns {object | null} Ranked snapshot statistics.
 */
function buildSnapshotStats(data, snapshotKey) {
  const countries = sortByShare(data?.data?.[snapshotKey] || []);
  const sectors = sortByShare(data?.sectorData?.[snapshotKey] || []);
  const namedCountries = countries.filter((country) => country.name !== OTHER_BUCKET_NAME);
  if (!namedCountries.length || !sectors.length) return null;

  const totalCountryShare = d3.sum(countries, (country) => country.value);
  const topCountry = namedCountries[0];
  const topSector = sectors[0];

  return {
    countries,
    namedCountries,
    sectors,
    topCountry,
    nextCountry: namedCountries[1],
    topSector,
    nextSector: sectors[1],
    topCountryRestShare: Math.max(0, totalCountryShare - topCountry.value),
    topFiveNamedShare: d3.sum(namedCountries.slice(0, 5), (country) => country.value),
    topThreeSectorShare: d3.sum(sectors.slice(0, 3), (sector) => sector.value),
  };
}

/**
 * Sorts treemap nodes by numeric share, highest first.
 *
 * @param {object[]} nodes Treemap nodes with value fields.
 * @returns {object[]} Sorted copy of the nodes.
 */
function sortByShare(nodes) {
  return nodes
    .filter((node) => Number.isFinite(Number(node.value)) && Number(node.value) > 0)
    .slice()
    .sort((a, b) => Number(b.value) - Number(a.value));
}

/**
 * Converts a share difference to percentage points.
 *
 * @param {number} current Current share.
 * @param {number | undefined} baseline Baseline share.
 * @returns {number} Percentage-point difference.
 */
function getPointDelta(current, baseline) {
  if (!Number.isFinite(baseline)) return 0;
  return (current - baseline) * 100;
}

/**
 * Builds the top-line narrative sentence for the snapshot.
 *
 * @param {object} topCountry Largest named country bucket.
 * @param {object} topSector Largest sector bucket.
 * @param {number} topCountrySectorContribution Top country contribution to top sector.
 * @returns {string} Human-readable dominance verdict.
 */
function buildVerdict(topCountry, topSector, topCountrySectorContribution) {
  return `${topCountry.name} carries ${formatShare(topCountry.value)} of country weight, ${topSector.name} carries ${formatShare(topSector.value)} of sector weight, and their overlap contributes about ${formatContribution(topCountrySectorContribution)} of the whole index.`;
}

/**
 * Creates the card configuration used by the DOM renderer.
 *
 * @param {object} summary Concentration summary.
 * @returns {object[]} Card definitions.
 */
function buildDominanceCards(summary) {
  return [
    {
      label: "Country carrier",
      metric: `${summary.topCountry.name} ${formatShare(summary.topCountry.value)}`,
      body:
        summary.topCountry.value > summary.topCountryRestShare
          ? `${summary.topCountry.name} is larger than every other country bucket combined.`
          : `${summary.topCountry.name} leads, but the rest of the index is still larger.`,
      rows: [
        ["Next named country", formatShare(summary.nextCountry?.value)],
        ["Top 5 named countries", formatShare(summary.topFiveNamedShare)],
        ["Change since first snapshot", `${formatSignedPoint(summary.topCountryDeltaPoints)} pp`],
      ],
      share: summary.topCountry.value,
    },
    {
      label: "Industry carrier",
      metric: `${summary.topSector.name} ${formatShare(summary.topSector.value)}`,
      body: `${summary.topSector.name} is the largest sector block; the top three sectors carry ${formatShare(summary.topThreeSectorShare)} together.`,
      rows: [
        ["Next sector", formatShare(summary.nextSector?.value)],
        ["Top 3 sectors", formatShare(summary.topThreeSectorShare)],
        ["Change since first snapshot", `${formatSignedPoint(summary.topSectorDeltaPoints)} pp`],
      ],
      share: summary.topSector.value,
    },
    {
      label: "Combined read",
      metric: `${formatContribution(summary.topCountrySectorContribution)} overlap`,
      body: `${summary.topCountry.name} alone supplies ${formatShare(summary.topCountrySectorBucketShare)} of the ${summary.topSector.name} bucket.`,
      rows: [
        ["Country", summary.topCountry.name],
        ["Industry", summary.topSector.name],
        ["Index contribution", formatContribution(summary.topCountrySectorContribution)],
      ],
      share: summary.topCountrySectorContribution,
    },
  ];
}

/**
 * Creates one metric card for the dominance summary.
 *
 * @param {object} card Card definition.
 * @returns {HTMLElement} Rendered card.
 */
function createDominanceCard(card) {
  const article = document.createElement("article");
  article.className = "treemap-dominance-card";

  const label = document.createElement("span");
  label.className = "treemap-dominance-card__label";
  label.textContent = card.label;

  const metric = document.createElement("strong");
  metric.className = "treemap-dominance-card__metric";
  metric.textContent = card.metric;

  const body = document.createElement("p");
  body.textContent = card.body;

  const meter = document.createElement("div");
  meter.className = "treemap-dominance-card__meter";
  const meterFill = document.createElement("span");
  meterFill.style.width = `${Math.min(100, Math.max(0, card.share * 100))}%`;
  meter.append(meterFill);

  const facts = document.createElement("dl");
  facts.className = "treemap-dominance-card__facts";
  for (const [term, value] of card.rows) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value || "—";
    facts.append(dt, dd);
  }

  article.append(label, metric, body, meter, facts);
  return article;
}
