"""
Preprocess economic data into a JSON file for the spider chart visualization.
"""

import json
import math
from pathlib import Path
import sys

import pandas as pd

try:
    import yfinance as yf
except ImportError:
    yf = None

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
PUBLIC_DIR = ROOT_DIR / "public"
BASELINE_YEAR = 2000
LATEST_YEAR = 2023 

# countries excluded due to spotty data
MC_EXCLUDE: set[str] = {"CHN", "IND", "SWE", "RUS"}

# ETF to ISO3 mapping
ETF_COUNTRY_MAP: dict[str, tuple[str, str]] = {
    "AUS": ("etf",  "EWA"),
    "CAN": ("etf",  "EWC"),
    "SWE": ("etf",  "EWD"),
    "DEU": ("etf",  "EWG"),
    "HKG": ("etf",  "EWH"),
    "ITA": ("etf",  "EWI"),
    "JPN": ("etf",  "EWJ"),
    "BEL": ("etf",  "EWK"),
    "CHE": ("etf",  "EWL"),
    "MYS": ("etf",  "EWM"),
    "NLD": ("etf",  "EWN"),
    "AUT": ("etf",  "EWO"),
    "ESP": ("etf",  "EWP"),
    "FRA": ("etf",  "EWQ"),
    "SGP": ("etf",  "EWS"),
    "GBR": ("etf",  "EWU"),
    "MEX": ("etf",  "EWW"),
    "KOR": ("etf",  "EWY"),
    "BRA": ("etf",  "EWZ"),
    "USA": ("hist", "SPY"),
}

# Region metadata used by the final narrative site.
REGION_BY_COUNTRY: dict[str, str] = {
    "AUS": "Asia-Pacific",
    "CAN": "North America",
    "SWE": "Europe",
    "DEU": "Europe",
    "HKG": "Asia-Pacific",
    "ITA": "Europe",
    "JPN": "Asia-Pacific",
    "BEL": "Europe",
    "CHE": "Europe",
    "MYS": "Asia-Pacific",
    "NLD": "Europe",
    "AUT": "Europe",
    "ESP": "Europe",
    "FRA": "Europe",
    "SGP": "Asia-Pacific",
    "GBR": "Europe",
    "MEX": "North America",
    "KOR": "Asia-Pacific",
    "BRA": "Latin America",
    "USA": "North America",
}

METRIC_METADATA: dict[str, dict[str, str | bool]] = {
    "GDP": {
        "unit": "current US$",
        "absoluteLabel": "Economic weight",
        "aggregate": "sum",
        "absoluteComparable": True,
    },
    "GDP per Capita": {
        "unit": "current US$ per person",
        "absoluteLabel": "Prosperity",
        "aggregate": "mean",
        "absoluteComparable": True,
    },
    "ETF Price": {
        "unit": "ETF share price, adjusted close",
        "absoluteLabel": "ETF price",
        "aggregate": "mean",
        "absoluteComparable": False,
    },
    "Market Cap": {
        "unit": "current US$",
        "absoluteLabel": "Listed company market value",
        "aggregate": "sum",
        "absoluteComparable": True,
    },
}

WB_SKIPROWS = 4
_yf_cache: dict[str, pd.DataFrame] = {}
FILL_WINDOW = 6

MODEL_PREFERENCES: dict[str, list[str]] = {
    "GDP": ["exponential", "linear"],
    "GDP per Capita": ["exponential", "linear"],
    "ETF Price": ["linear", "exponential"],
    "Market Cap": ["etf_proxy", "exponential", "linear"],
}


# ── Data helpers ──────────────────────────────────────────────────────────────

def load_wb(filename: str) -> pd.DataFrame:
    path = DATA_DIR / "worldbank" / filename
    df = pd.read_csv(path, skiprows=WB_SKIPROWS, index_col="Country Code")
    for col in df.columns:
        if str(col).strip().isdigit():
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def _get_yf_supplement(symbol: str) -> pd.DataFrame:
    """Download 2020-2024 data via yfinance (cached). Returns df with 'close' column."""
    if symbol in _yf_cache:
        return _yf_cache[symbol]
    if yf is None:
        print(f"  yfinance unavailable for {symbol}; using local ETF history only.", file=sys.stderr)
        _yf_cache[symbol] = pd.DataFrame()
        return _yf_cache[symbol]
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(start="2019-12-01", end="2024-06-30", auto_adjust=True)
        if len(hist) == 0:
            _yf_cache[symbol] = pd.DataFrame()
            return _yf_cache[symbol]
        if hist.index.tz is not None:
            hist.index = hist.index.tz_localize(None)
        out = hist[["Close"]].rename(columns={"Close": "close"}).copy()
        _yf_cache[symbol] = out
        return out
    except Exception as e:
        print(f"  yfinance error for {symbol}: {e}", file=sys.stderr)
        _yf_cache[symbol] = pd.DataFrame()
        return _yf_cache[symbol]


def load_etf_data(source: str, symbol: str) -> pd.DataFrame:
    """Load ETF data from local file, supplement with yfinance for post-2020 years.
    Returns a DataFrame with a 'close' column, indexed by date (ascending)."""
    if source == "etf":
        path = DATA_DIR / "nasdaq" / "etf" / f"{symbol}.csv"
        df = pd.read_csv(path, index_col="Date", parse_dates=True)
        df = df.rename(columns={"Close": "close"})
    elif source == "hist":
        path = DATA_DIR / "stock" / "history" / f"{symbol}.csv"
        df = pd.read_csv(path, index_col="date", parse_dates=True)
        df = df.rename(columns={"close": "close"})
        df = df.sort_index()
    else:
        raise ValueError(f"Unknown ETF source: {source}")

    file_end = df.index.max()

    if file_end.year < LATEST_YEAR:
        extra = _get_yf_supplement(symbol)
        if len(extra) > 0:
            extra = extra[extra.index > file_end]
            if len(extra) > 0:
                df = pd.concat([df[["close"]], extra])
                df = df[~df.index.duplicated(keep="first")].sort_index()

    return df[["close"]]


def get_annual_etf_price(df: pd.DataFrame, year: int) -> float | None:
    """Return close price of first trading day in the given year."""
    year_data = df[df.index.year == year]
    if len(year_data) == 0:
        return None
    return float(year_data.sort_index().iloc[0]["close"])


def get_wb_series(df: pd.DataFrame, iso3: str, years: list[int]) -> dict | None:
    if iso3 not in df.index:
        return None
    row = df.loc[iso3]
    return {
        y: (float(v) if pd.notna(v := row.get(str(y))) else None)
        for y in years
    }


# ── Market cap gap-filling ─────────────────────────────────────────────────────

def fill_mc_gaps(
    mc_series: dict[int, float | None],
    etf_df: pd.DataFrame,
    years: list[int],
) -> tuple[dict[int, float | None], int]:
    """
    Fill missing market cap values using ETF price growth as a proxy.
    Estimate: MC(year) ≈ MC(last_known) × (ETF(year) / ETF(last_known))
    Returns (filled_series, n_filled).
    """
    filled = mc_series.copy()
    last_known_mc: float | None = None
    last_known_etf: float | None = None
    n_filled = 0

    for year in years:
        mc_val = filled.get(year)
        etf_val = get_annual_etf_price(etf_df, year)
        if mc_val is not None and mc_val > 0 and etf_val is not None:
            last_known_mc = mc_val
            last_known_etf = etf_val
        elif (
            mc_val is None
            and last_known_mc is not None
            and last_known_etf is not None
            and etf_val is not None
        ):
            filled[year] = last_known_mc * (etf_val / last_known_etf)
            n_filled += 1

    return filled, n_filled


def fill_mc_gaps_with_flags(
    mc_series: dict[int, float | None],
    etf_df: pd.DataFrame,
    years: list[int],
) -> tuple[dict[int, float | None], dict[int, bool]]:
    """Market-cap-specific gap fill using ETF growth as proxy."""
    filled = mc_series.copy()
    flags = {year: False for year in years}
    last_known_mc: float | None = None
    last_known_etf: float | None = None

    for year in years:
        mc_val = filled.get(year)
        etf_val = get_annual_etf_price(etf_df, year)
        if mc_val is not None and mc_val > 0 and etf_val is not None:
            last_known_mc = mc_val
            last_known_etf = etf_val
            continue

        if (
            mc_val is None
            and last_known_mc is not None
            and last_known_etf is not None
            and etf_val is not None
            and etf_val > 0
        ):
            filled[year] = last_known_mc * (etf_val / last_known_etf)
            flags[year] = True

    return filled, flags


def fit_linear_model(points: list[tuple[int, float]]) -> tuple[float, float] | None:
    if len(points) < 2:
        return None
    xs = [year for year, _ in points]
    ys = [value for _, value in points]
    x_mean = sum(xs) / len(xs)
    y_mean = sum(ys) / len(ys)
    denominator = sum((x - x_mean) ** 2 for x in xs)
    if denominator == 0:
        return None
    slope = sum((x - x_mean) * (y - y_mean) for x, y in points) / denominator
    intercept = y_mean - slope * x_mean
    return intercept, slope


def fit_exponential_model(points: list[tuple[int, float]]) -> tuple[float, float] | None:
    if len(points) < 2 or any(value <= 0 for _, value in points):
        return None
    log_points = [(year, math.log(value)) for year, value in points]
    fitted = fit_linear_model(log_points)
    if fitted is None:
        return None
    intercept, slope = fitted
    return math.exp(intercept), slope


def predict_linear(params: tuple[float, float], year: int) -> float:
    intercept, slope = params
    return intercept + slope * year


def predict_exponential(params: tuple[float, float], year: int) -> float:
    scale, slope = params
    return scale * math.exp(slope * year)


def fit_model(points: list[tuple[int, float]], model: str):
    if model == "linear":
        return fit_linear_model(points)
    if model == "exponential":
        return fit_exponential_model(points)
    return None


def predict_model(params, year: int, model: str) -> float | None:
    if params is None:
        return None
    if model == "linear":
        return predict_linear(params, year)
    if model == "exponential":
        return predict_exponential(params, year)
    return None


def model_error(points: list[tuple[int, float]], model: str) -> float:
    params = fit_model(points, model)
    if params is None:
        return float("inf")
    total = 0.0
    count = 0
    for year, actual in points:
        predicted = predict_model(params, year, model)
        if predicted is None or predicted <= 0 or actual <= 0:
            return float("inf")
        total += ((predicted - actual) / actual) ** 2
        count += 1
    return total / count if count > 0 else float("inf")


def choose_fill_model(metric: str, raw: dict[int, float | None]) -> str | None:
    observed = [(year, value) for year, value in raw.items() if value is not None]
    if len(observed) < 2:
        return None

    ordered = MODEL_PREFERENCES.get(metric, ["linear", "exponential"])
    best_score = min(model_error(observed, model) for model in ordered if model != "etf_proxy")

    for model in ordered:
        if model == "etf_proxy":
            continue
        score = model_error(observed, model)
        if math.isfinite(score) and score <= best_score * 1.05:
            return model

    return None


def interpolate_between(
    left_year: int,
    left_value: float,
    right_year: int,
    right_value: float,
    target_year: int,
    model: str,
) -> float | None:
    span = right_year - left_year
    if span <= 0:
        return None
    share = (target_year - left_year) / span
    if model == "exponential" and left_value > 0 and right_value > 0:
        return left_value * ((right_value / left_value) ** share)
    return left_value + (right_value - left_value) * share


def predict_from_window(
    points: list[tuple[int, float]],
    target_year: int,
    model: str,
) -> float | None:
    params = fit_model(points, model)
    predicted = predict_model(params, target_year, model)
    if predicted is None:
        return None
    return predicted if predicted > 0 else None


def fill_series_gaps(
    raw: dict[int, float | None],
    years: list[int],
    metric: str,
    etf_df: pd.DataFrame | None = None,
) -> tuple[dict[int, float | None], dict[int, bool], str | None]:
    missing_years = [year for year in years if raw.get(year) is None]
    flags = {year: False for year in years}
    if not missing_years:
        return raw.copy(), flags, None

    filled = raw.copy()
    model_prefix: str | None = None

    if metric == "Market Cap" and etf_df is not None:
        filled, mc_flags = fill_mc_gaps_with_flags(filled, etf_df, years)
        if any(mc_flags.values()):
            flags = {
                year: bool(flags[year] or mc_flags[year])
                for year in years
            }
            model_prefix = "etf_proxy"

    remaining_missing_years = [year for year in years if filled.get(year) is None]
    if not remaining_missing_years:
        return filled, flags, model_prefix

    model = choose_fill_model(metric, filled)
    if model is None:
        return filled, flags, model_prefix

    observed = [(year, value) for year, value in filled.items() if value is not None]
    observed_years = [year for year, _ in observed]

    for year in remaining_missing_years:
        left_years = [known for known in observed_years if known < year]
        right_years = [known for known in observed_years if known > year]
        predicted: float | None = None

        if left_years and right_years:
            left_year = left_years[-1]
            right_year = right_years[0]
            predicted = interpolate_between(
                left_year,
                filled[left_year],
                right_year,
                filled[right_year],
                year,
                model,
            )
        elif left_years:
            window_years = left_years[-FILL_WINDOW:]
            points = [(known, filled[known]) for known in window_years]
            predicted = predict_from_window(points, year, model)
        elif right_years:
            window_years = right_years[:FILL_WINDOW]
            points = [(known, filled[known]) for known in window_years]
            predicted = predict_from_window(points, year, model)

        if predicted is not None and predicted > 0:
            filled[year] = predicted
            flags[year] = True

    if model_prefix:
        return filled, flags, f"{model_prefix}+{model}"
    return filled, flags, model


# ── Normalization ─────────────────────────────────────────────────────────────

def normalize_series(raw: dict, years: list[int], base: float) -> list:
    return [
        round(raw[y] / base, 4) if raw.get(y) is not None else None
        for y in years
    ]


def absolute_series(raw: dict, years: list[int]) -> list:
    return [
        round(raw[y], 4) if raw.get(y) is not None else None
        for y in years
    ]


def make_metric_series(
    raw: dict[int, float | None],
    years: list[int],
    base: float,
    metric: str,
    etf_df: pd.DataFrame | None = None,
) -> dict:
    metadata = METRIC_METADATA[metric]
    filled_raw, extrapolated_flags, fit_model_name = fill_series_gaps(
        raw, years, metric, etf_df
    )
    return {
        "normalized": normalize_series(filled_raw, years, base),
        "absolute": absolute_series(filled_raw, years),
        "normalizedExtrapolated": [bool(extrapolated_flags[year]) for year in years],
        "absoluteExtrapolated": [bool(extrapolated_flags[year]) for year in years],
        "fitModel": fit_model_name,
        "unit": metadata["unit"],
        "absoluteComparable": metadata["absoluteComparable"],
    }


def aggregate_region_metric(
    countries_out: dict,
    region: str,
    metric: str,
    years: list[int],
) -> dict | None:
    members = [
        country for country in countries_out.values()
        if country["region"] == region and metric in country["timeseries"]
    ]
    if not members:
        return None

    aggregate = METRIC_METADATA[metric]["aggregate"]
    normalized = []
    absolute = []
    normalized_extrapolated = []
    absolute_extrapolated = []

    for index, _year in enumerate(years):
        normalized_values = []
        normalized_flags = []
        absolute_values = []
        absolute_flags = []

        for member in members:
            series = member["timeseries"][metric]
            normalized_value = series["normalized"][index]
            absolute_value = series["absolute"][index]
            if normalized_value is not None:
                normalized_values.append(normalized_value)
                normalized_flags.append(series["normalizedExtrapolated"][index])
            if absolute_value is not None:
                absolute_values.append(absolute_value)
                absolute_flags.append(series["absoluteExtrapolated"][index])

        normalized.append(
            round(sum(normalized_values) / len(normalized_values), 4)
            if normalized_values else None
        )
        normalized_extrapolated.append(any(normalized_flags) if normalized_flags else False)

        if not absolute_values:
            absolute.append(None)
            absolute_extrapolated.append(False)
        elif aggregate == "sum":
            absolute.append(round(sum(absolute_values), 4))
            absolute_extrapolated.append(any(absolute_flags))
        else:
            absolute.append(round(sum(absolute_values) / len(absolute_values), 4))
            absolute_extrapolated.append(any(absolute_flags))

    metadata = METRIC_METADATA[metric]
    return {
        "normalized": normalized,
        "absolute": absolute,
        "normalizedExtrapolated": normalized_extrapolated,
        "absoluteExtrapolated": absolute_extrapolated,
        "fitModel": "aggregate",
        "unit": metadata["unit"],
        "absoluteComparable": metadata["absoluteComparable"],
    }


def build_region_dataset(countries_out: dict, years: list[int], axes: list[str]) -> dict:
    regions_out: dict = {}
    for region in sorted(set(REGION_BY_COUNTRY.values())):
        timeseries = {}
        for metric in axes:
            aggregated = aggregate_region_metric(countries_out, region, metric, years)
            if aggregated is not None:
                timeseries[metric] = aggregated
        regions_out[region] = {"name": region, "timeseries": timeseries}
    return regions_out


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("Loading World Bank data...")
    iso_codes = pd.read_csv(
        DATA_DIR / "iso" / "countries.csv", index_col="alpha-3"
    )
    gdp = load_wb("gdp-current-usd-2026.csv")
    gdp_pc = load_wb("gdp-capita-current-usd-2026.csv")
    market_cap_raw = load_wb("market-cap-current-usd-2026.csv")

    years = list(range(BASELINE_YEAR, LATEST_YEAR + 1))
    countries_out: dict = {}

    for iso3, (source, symbol) in ETF_COUNTRY_MAP.items():
        print(f"\nProcessing {iso3} ({symbol})...", end=" ", flush=True)

        try:
            etf_df = load_etf_data(source, symbol)
        except FileNotFoundError:
            print("SKIP: ETF file not found")
            continue

        gdp_series = get_wb_series(gdp, iso3, years)
        gdp_pc_series = get_wb_series(gdp_pc, iso3, years)
        if gdp_series is None or gdp_pc_series is None:
            print("SKIP: no World Bank GDP data")
            continue

        gdp_base = gdp_series.get(BASELINE_YEAR)
        gdp_pc_base = gdp_pc_series.get(BASELINE_YEAR)
        etf_base = get_annual_etf_price(etf_df, BASELINE_YEAR)

        if not gdp_base:
            print(f"SKIP: missing GDP baseline ({BASELINE_YEAR})")
            continue
        if not gdp_pc_base:
            print(f"SKIP: missing GDP/capita baseline ({BASELINE_YEAR})")
            continue
        if not etf_base:
            print(f"SKIP: missing ETF baseline ({BASELINE_YEAR})")
            continue

        etf_raw = {y: get_annual_etf_price(etf_df, y) for y in years}

        timeseries: dict = {
            "GDP": make_metric_series(gdp_series, years, gdp_base, "GDP"),
            "GDP per Capita": make_metric_series(
                gdp_pc_series, years, gdp_pc_base, "GDP per Capita"
            ),
            "ETF Price": make_metric_series(
                etf_raw, years, etf_base, "ETF Price", etf_df
            ),
        }

        # Market cap (optional; excluded for CHN, IND, SWE, RUS)
        if iso3 not in MC_EXCLUDE:
            mc_series = get_wb_series(market_cap_raw, iso3, years)
            mc_base = mc_series.get(BASELINE_YEAR) if mc_series else None
            if mc_series and mc_base and mc_base > 0:
                timeseries["Market Cap"] = make_metric_series(
                    mc_series, years, mc_base, "Market Cap", etf_df
                )
                n_filled = sum(timeseries["Market Cap"]["absoluteExtrapolated"])
                fill_model_name = timeseries["Market Cap"]["fitModel"] or "none"
                suffix = f"MC ok ({n_filled} years filled via {fill_model_name})"
            else:
                suffix = "MC skipped: no 2000 baseline"
        else:
            suffix = "MC excluded (spotty data)"

        country_name = (
            iso_codes.loc[iso3, "name"] if iso3 in iso_codes.index else iso3
        )
        countries_out[iso3] = {
            "name": str(country_name),
            "region": REGION_BY_COUNTRY[iso3],
            "etf": symbol,
            "timeseries": timeseries,
        }
        print(f"OK – {suffix}")

    mc_count = sum(1 for c in countries_out.values() if "Market Cap" in c["timeseries"])
    universal_axes = ["GDP", "GDP per Capita", "ETF Price"]
    if mc_count > 0:
        universal_axes.append("Market Cap")
    regions_out = build_region_dataset(countries_out, years, universal_axes)

    output = {
        "baselineYear": BASELINE_YEAR,
        "latestYear": LATEST_YEAR,
        "years": years,
        "axes": universal_axes,
        "metricMetadata": METRIC_METADATA,
        "regions": sorted(set(REGION_BY_COUNTRY.values())),
        "regionsData": regions_out,
        "mcExcluded": sorted(MC_EXCLUDE),
        "countries": countries_out,
    }

    PUBLIC_DIR.mkdir(exist_ok=True)
    output_path = PUBLIC_DIR / "spider_data.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
        f.write("\n")

    # summary
    print(f"\n Wrote {len(countries_out)} countries to {output_path}")
    print(f"  Axes : {universal_axes}")
    print(f"  Years: {years[0]}–{years[-1]}")
    print(f"  MC available for {mc_count}/{len(countries_out)} countries")
    print(f"  MC excluded: {sorted(MC_EXCLUDE)}")


if __name__ == "__main__":
    main()
