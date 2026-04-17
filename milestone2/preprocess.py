"""
Preprocess economic data into a JSON file for the spider chart visualization.
"""

import json
import os
import sys

import pandas as pd
import yfinance as yf

DATA_DIR = "data"
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

WB_SKIPROWS = 4
_yf_cache: dict[str, pd.DataFrame] = {}


# ── Data helpers ──────────────────────────────────────────────────────────────

def load_wb(filename: str) -> pd.DataFrame:
    path = os.path.join(DATA_DIR, "worldbank", filename)
    df = pd.read_csv(path, skiprows=WB_SKIPROWS, index_col="Country Code")
    for col in df.columns:
        if str(col).strip().isdigit():
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def _get_yf_supplement(symbol: str) -> pd.DataFrame:
    """Download 2020-2024 data via yfinance (cached). Returns df with 'close' column."""
    if symbol in _yf_cache:
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
        path = os.path.join(DATA_DIR, "nasdaq", "etf", f"{symbol}.csv")
        df = pd.read_csv(path, index_col="Date", parse_dates=True)
        df = df.rename(columns={"Close": "close"})
    elif source == "hist":
        path = os.path.join(DATA_DIR, "stock", "history", f"{symbol}.csv")
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


# ── Normalization ─────────────────────────────────────────────────────────────

def normalize_series(raw: dict, years: list[int], base: float) -> list:
    return [
        round(raw[y] / base, 4) if raw.get(y) is not None else None
        for y in years
    ]


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("Loading World Bank data...")
    iso_codes = pd.read_csv(
        os.path.join(DATA_DIR, "iso", "countries.csv"), index_col="alpha-3"
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
            "GDP": normalize_series(gdp_series, years, gdp_base),
            "GDP per Capita": normalize_series(gdp_pc_series, years, gdp_pc_base),
            "ETF Price": normalize_series(etf_raw, years, etf_base),
        }

        # Market cap (optional; excluded for CHN, IND, SWE, RUS)
        if iso3 not in MC_EXCLUDE:
            mc_series = get_wb_series(market_cap_raw, iso3, years)
            mc_base = mc_series.get(BASELINE_YEAR) if mc_series else None
            if mc_series and mc_base and mc_base > 0:
                mc_filled, n_filled = fill_mc_gaps(mc_series, etf_df, years)
                timeseries["Market Cap"] = normalize_series(mc_filled, years, mc_base)
                suffix = f"MC ok ({n_filled} years ETF-proxy filled)"
            else:
                suffix = "MC skipped: no 2000 baseline"
        else:
            suffix = "MC excluded (spotty data)"

        country_name = (
            iso_codes.loc[iso3, "name"] if iso3 in iso_codes.index else iso3
        )
        countries_out[iso3] = {
            "name": str(country_name),
            "etf": symbol,
            "timeseries": timeseries,
        }
        print(f"OK – {suffix}")

    mc_count = sum(1 for c in countries_out.values() if "Market Cap" in c["timeseries"])
    universal_axes = ["GDP", "GDP per Capita", "ETF Price"]
    if mc_count > 0:
        universal_axes.append("Market Cap")

    output = {
        "baselineYear": BASELINE_YEAR,
        "latestYear": LATEST_YEAR,
        "years": years,
        "axes": universal_axes,
        "mcExcluded": sorted(MC_EXCLUDE),
        "countries": countries_out,
    }

    os.makedirs("../public", exist_ok=True)
    output_path = "../public/spider_data.json"
    with open(output_path, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    # summary
    print(f"\n Wrote {len(countries_out)} countries to {output_path}")
    print(f"  Axes : {universal_axes}")
    print(f"  Years: {years[0]}–{years[-1]}")
    print(f"  MC available for {mc_count}/{len(countries_out)} countries")
    print(f"  MC excluded: {sorted(MC_EXCLUDE)}")


if __name__ == "__main__":
    main()

