/**
 * Shared data helpers and country metadata for the Europe-vs-world economic
 * growth story.
 */

export const DEFAULT_SELECTION = ["DEU", "FRA", "GBR", "USA", "JPN"];

export const REGION_ORDER = [
  "Europe",
  "North America",
  "Asia-Pacific",
  "Latin America",
];

export const REGION_COLORS = {
  Europe: "#76a9ff",
  "North America": "#ff8f70",
  "Asia-Pacific": "#65d6ad",
  "Latin America": "#f7c66b",
};

export const COUNTRY_COLORS = {
  AUS: "#4dd0c8",
  CAN: "#ffb06e",
  SWE: "#7fb0ff",
  DEU: "#4f8cff",
  HKG: "#55df9b",
  ITA: "#8f8cff",
  JPN: "#2dd4bf",
  BEL: "#5fd0ff",
  CHE: "#a78bfa",
  MYS: "#34c759",
  NLD: "#38bdf8",
  AUT: "#93c5fd",
  ESP: "#60a5fa",
  FRA: "#818cf8",
  SGP: "#8ee6c8",
  GBR: "#3b82f6",
  MEX: "#ff765e",
  KOR: "#14b8a6",
  BRA: "#f7c66b",
  USA: "#ff9f9a",
};

export const AXIS_DESCRIPTIONS = {
  GDP: "Total economic output, normalized to each country in 2000.",
  "GDP per Capita": "Prosperity per person, normalized to each country in 2000.",
  "ETF Price": "Investable public-market proxy, normalized to each ETF in 2000.",
  "Market Cap": "Domestic listed-company market cap, normalized to 2000 where reliable.",
};

export const FALLBACK_METRIC_METADATA = {
  GDP: {
    unit: "current US$",
    aggregate: "sum",
    absoluteComparable: true,
  },
  "GDP per Capita": {
    unit: "current US$ per person",
    aggregate: "mean",
    absoluteComparable: true,
  },
  "ETF Price": {
    unit: "ETF share price",
    aggregate: "mean",
    absoluteComparable: false,
  },
  "Market Cap": {
    unit: "current US$",
    aggregate: "sum",
    absoluteComparable: true,
  },
};

export const COUNTRY_METADATA = {
  AUS: { shortName: "Australia", region: "Asia-Pacific", mapX: 78, mapY: 78, flag: "🇦🇺" },
  CAN: { shortName: "Canada", region: "North America", mapX: 18, mapY: 22, flag: "🇨🇦" },
  SWE: { shortName: "Sweden", region: "Europe", mapX: 50, mapY: 18, flag: "🇸🇪" },
  DEU: { shortName: "Germany", region: "Europe", mapX: 50, mapY: 34, flag: "🇩🇪" },
  HKG: { shortName: "Hong Kong", region: "Asia-Pacific", mapX: 76, mapY: 52, flag: "🇭🇰" },
  ITA: { shortName: "Italy", region: "Europe", mapX: 51, mapY: 46, flag: "🇮🇹" },
  JPN: { shortName: "Japan", region: "Asia-Pacific", mapX: 86, mapY: 42, flag: "🇯🇵" },
  BEL: { shortName: "Belgium", region: "Europe", mapX: 46, mapY: 35, flag: "🇧🇪" },
  CHE: { shortName: "Switzerland", region: "Europe", mapX: 48, mapY: 42, flag: "🇨🇭" },
  MYS: { shortName: "Malaysia", region: "Asia-Pacific", mapX: 73, mapY: 62, flag: "🇲🇾" },
  NLD: { shortName: "Netherlands", region: "Europe", mapX: 47, mapY: 30, flag: "🇳🇱" },
  AUT: { shortName: "Austria", region: "Europe", mapX: 53, mapY: 40, flag: "🇦🇹" },
  ESP: { shortName: "Spain", region: "Europe", mapX: 41, mapY: 50, flag: "🇪🇸" },
  FRA: { shortName: "France", region: "Europe", mapX: 43, mapY: 42, flag: "🇫🇷" },
  SGP: { shortName: "Singapore", region: "Asia-Pacific", mapX: 75, mapY: 68, flag: "🇸🇬" },
  GBR: { shortName: "United Kingdom", region: "Europe", mapX: 42, mapY: 30, flag: "🇬🇧" },
  MEX: { shortName: "Mexico", region: "North America", mapX: 20, mapY: 55, flag: "🇲🇽" },
  KOR: { shortName: "South Korea", region: "Asia-Pacific", mapX: 82, mapY: 46, flag: "🇰🇷" },
  BRA: { shortName: "Brazil", region: "Latin America", mapX: 34, mapY: 75, flag: "🇧🇷" },
  USA: { shortName: "United States", region: "North America", mapX: 21, mapY: 38, flag: "🇺🇸" },
};

export const WORLD_ATLAS_ID_TO_ISO3 = {
  "036": "AUS",
  "040": "AUT",
  "056": "BEL",
  "076": "BRA",
  "124": "CAN",
  "250": "FRA",
  "276": "DEU",
  "344": "HKG",
  "380": "ITA",
  "392": "JPN",
  "410": "KOR",
  "458": "MYS",
  "484": "MEX",
  "528": "NLD",
  "702": "SGP",
  "724": "ESP",
  "752": "SWE",
  "756": "CHE",
  "826": "GBR",
  "840": "USA",
};

/**
 * Returns a country value for the requested indicator/year.
 *
 * @param {object} country Country data loaded from spider_data.json.
 * @param {string} axis Indicator name.
 * @param {number} yearIndex Zero-based index into each time series.
 * @returns {number | null} Normalized value or null if unavailable.
 */
export function getCountryValue(country, axis, yearIndex) {
  return getCountryMetricValue(country, axis, yearIndex, "growth");
}

/**
 * Returns a country metric in growth or absolute mode.
 *
 * @param {object} country Country data loaded from spider_data.json.
 * @param {string} axis Indicator name.
 * @param {number} yearIndex Zero-based index into each time series.
 * @param {"growth" | "absolute"} valueMode Value mode.
 * @returns {number | null} Metric value.
 */
export function getCountryMetricValue(country, axis, yearIndex, valueMode) {
  const series = normalizeMetricSeries(country.timeseries[axis]);
  if (!series || yearIndex < 0) return null;
  const values =
    valueMode === "absolute" && series.absolute ? series.absolute : series.normalized;
  if (!values || yearIndex >= values.length) return null;
  return values[yearIndex] ?? null;
}

/**
 * Normalizes old array-based and new object-based metric series.
 *
 * @param {object | number[] | null} series Raw series.
 * @returns {{ normalized: number[], absolute: number[] | null, unit: string | null, absoluteComparable: boolean } | null}
 */
export function normalizeMetricSeries(series) {
  if (!series) return null;
  if (Array.isArray(series)) {
    return {
      normalized: series,
      absolute: null,
      unit: null,
      absoluteComparable: false,
    };
  }
  return {
    normalized: series.normalized ?? [],
    absolute: series.absolute ?? null,
    unit: series.unit ?? null,
    absoluteComparable: Boolean(series.absoluteComparable),
  };
}

/**
 * Converts a year into the matching zero-based index for normalized series.
 *
 * @param {object} data Loaded spider data.
 * @param {number} year Selected year.
 * @returns {number} Series index.
 */
export function getYearIndex(data, year) {
  return year - data.baselineYear;
}

/**
 * Returns the preferred display name for a country code.
 *
 * @param {string} iso3 ISO-3 country code.
 * @returns {string} Short country label.
 */
export function getCountryLabel(iso3) {
  const metadata = COUNTRY_METADATA[iso3];
  if (!metadata) throw new Error(`Missing country metadata for ${iso3}`);
  return metadata.shortName;
}

/**
 * Computes average regional growth multiples for a given axis and year.
 *
 * @param {object} data Loaded spider data.
 * @param {string} axis Indicator name.
 * @param {number} yearIndex Zero-based year index.
 * @returns {{ region: string, value: number | null, count: number }[]} Region averages.
 */
export function calculateRegionAverages(data, axis, yearIndex) {
  return REGION_ORDER.map((region) => {
    const values = Object.entries(data.countries)
      .filter(([iso3]) => COUNTRY_METADATA[iso3]?.region === region)
      .map(([, country]) => getCountryMetricValue(country, axis, yearIndex, "growth"))
      .filter((value) => value !== null);

    const total = values.reduce((sum, value) => sum + value, 0);
    return {
      region,
      value: values.length > 0 ? total / values.length : null,
      count: values.length,
    };
  });
}

/**
 * Computes a regional average for one axis, preserving null for empty regions.
 *
 * @param {object} data Loaded spider data.
 * @param {string} region Region name.
 * @param {string} axis Indicator name.
 * @param {number} yearIndex Zero-based year index.
 * @returns {number | null} Regional average.
 */
export function calculateRegionAxisValue(data, region, axis, yearIndex) {
  return calculateRegionMetricValue(data, region, axis, yearIndex, "growth");
}

/**
 * Computes a regional value for one axis in growth or absolute mode.
 *
 * @param {object} data Loaded spider data.
 * @param {string} region Region name.
 * @param {string} axis Indicator name.
 * @param {number} yearIndex Zero-based year index.
 * @param {"growth" | "absolute"} valueMode Value mode.
 * @returns {number | null} Regional aggregate.
 */
export function calculateRegionMetricValue(data, region, axis, yearIndex, valueMode) {
  const values = Object.entries(data.countries)
    .filter(([iso3]) => COUNTRY_METADATA[iso3]?.region === region)
    .map(([, country]) => getCountryMetricValue(country, axis, yearIndex, valueMode))
    .filter((value) => value !== null);
  if (values.length === 0) return null;
  const aggregate = getMetricMetadata(data, axis).aggregate;
  const total = values.reduce((sum, value) => sum + value, 0);
  return valueMode === "absolute" && aggregate === "sum"
    ? total
    : total / values.length;
}

/**
 * Builds spider-chart profiles for either selected countries or selected regions.
 *
 * @param {object} data Loaded spider data.
 * @param {number} yearIndex Zero-based year index.
 * @param {string[]} selectedIso3 Selected country codes.
 * @param {string[]} selectedRegions Selected region names.
 * @param {"countries" | "regions"} selectionMode Active selection mode.
 * @returns {{ id: string, label: string, color: string, values: (number | null)[] }[]} Profiles.
 */
export function buildComparisonProfiles(
  data,
  yearIndex,
  selectedIso3,
  selectedRegions,
  selectionMode,
) {
  if (selectionMode === "regions") {
    return selectedRegions.map((region) => ({
      id: region,
      label: region,
      color: REGION_COLORS[region],
      values: data.axes.map((axis) =>
        calculateRegionAxisValue(data, region, axis, yearIndex),
      ),
    }));
  }

  return selectedIso3.map((iso3) => {
    const country = data.countries[iso3];
    const metadata = COUNTRY_METADATA[iso3];
    if (!country || !metadata) throw new Error(`Missing country data for ${iso3}`);
    return {
      id: iso3,
      label: iso3,
      color: COUNTRY_COLORS[iso3],
      values: data.axes.map((axis) =>
        getCountryMetricValue(country, axis, yearIndex, "growth"),
      ),
    };
  });
}

/**
 * Returns metadata for a metric, supporting old processed JSON files.
 *
 * @param {object} data Loaded spider data.
 * @param {string} axis Indicator name.
 * @returns {object} Metric metadata.
 */
export function getMetricMetadata(data, axis) {
  return data.metricMetadata?.[axis] ?? FALLBACK_METRIC_METADATA[axis] ?? {
    unit: "",
    aggregate: "mean",
    absoluteComparable: false,
  };
}

/**
 * Returns whether a metric can tell a meaningful absolute-value story.
 *
 * @param {object} data Loaded spider data.
 * @param {string} axis Indicator name.
 * @returns {boolean} Whether absolute mode is meaningful and available.
 */
export function hasAbsoluteMetric(data, axis) {
  const metadata = getMetricMetadata(data, axis);
  if (!metadata.absoluteComparable) return false;
  return Object.values(data.countries).some((country) => {
    const series = normalizeMetricSeries(country.timeseries[axis]);
    return Boolean(series?.absolute?.some((value) => value !== null));
  });
}

/**
 * Formats normalized values as compact growth multiples.
 *
 * @param {number | null} value Normalized value.
 * @returns {string} Display text.
 */
export function formatMultiple(value) {
  if (value === null) return "n/a";
  return `${value.toFixed(2)}x`;
}

/**
 * Formats a value for the selected metric and mode.
 *
 * @param {object} data Loaded spider data.
 * @param {string} axis Indicator name.
 * @param {number | null} value Value to format.
 * @param {"growth" | "absolute"} valueMode Value mode.
 * @returns {string} Display text.
 */
export function formatMetricValue(data, axis, value, valueMode) {
  if (value === null) return "n/a";
  if (valueMode !== "absolute") return formatMultiple(value);
  const unit = getMetricMetadata(data, axis).unit;
  if (unit.includes("US$")) return formatCurrency(value);
  return `${value.toFixed(2)} ${unit}`;
}

/**
 * Formats large dollar values compactly.
 *
 * @param {number} value Dollar value.
 * @returns {string} Compact currency text.
 */
function formatCurrency(value) {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}
