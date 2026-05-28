#!/usr/bin/env python3

"""Build living-cost vs pay data for the 2008 narrative add-on."""

from __future__ import annotations

import csv
import io
import json
from collections import defaultdict
from pathlib import Path
from statistics import mean

import requests

OUTPUT_PATH = Path("public/living_cost_pay_data.json")
DATA_DIR = Path("data/worldbank")
YEARS = list(range(2000, 2026))
PROJECT_EUROPE = ["SWE", "DEU", "ITA", "BEL", "CHE", "NLD", "AUT", "ESP", "FRA", "GBR"]
OECD_HOUSING_EUROPE = ["DEU", "GBR", "NLD", "SWE", "CHE"]
RHPI_EUROPE = ["BEL", "DEU", "ESP", "FRA", "GBR", "NLD", "SWE", "CHE"]
HEADERS = {"Accept": "text/csv", "User-Agent": "Mozilla/5.0"}

OECD_WAGE_URL = "https://sdmx.oecd.org/public/rest/data/OECD.ELS.SAE,DSD_EARNINGS@AV_AN_WAGE,1.0/all?startPeriod=2000&dimensionAtObservation=AllDimensions"
OECD_HOUSING_URL = "https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_RHPI@DF_RHPI_ALL,1.0/all?startPeriod=2000&dimensionAtObservation=AllDimensions"


def fetch_csv(url: str) -> list[dict[str, str]]:
    response = requests.get(url, headers=HEADERS, timeout=180)
    response.raise_for_status()
    return list(csv.DictReader(io.StringIO(response.text)))


def load_world_bank(filename: str) -> dict[str, dict[int, float]]:
    with (DATA_DIR / filename).open(encoding="utf-8-sig") as handle:
        for _ in range(4):
            next(handle)
        rows = csv.DictReader(handle)
        out = {}
        for row in rows:
            code = row["Country Code"]
            values = {}
            for year in range(2000, 2024):
                raw = row.get(str(year))
                if raw not in (None, ""):
                    values[year] = float(raw)
            if values:
                out[code] = values
    return out


def indexed(values: dict[int, float], base_year: int = 2008) -> list[dict[str, float | int]]:
    base = values.get(base_year)
    if not base:
        return []
    return [
        {"year": year, "value": value / base}
        for year, value in sorted(values.items())
        if year >= 2000 and value is not None
    ]


def indexed_map(values: dict[int, float], base_year: int = 2008) -> dict[int, float]:
    return {row["year"]: row["value"] for row in indexed(values, base_year)}


def mean_index(series_by_area: dict[str, dict[int, float]], areas: list[str]) -> list[dict[str, float | int]]:
    out = {}
    indexed_by_area = {area: indexed_map(series_by_area[area]) for area in areas if area in series_by_area}
    for year in YEARS:
        values = [series[year] for series in indexed_by_area.values() if year in series]
        if values:
            out[year] = mean(values)
    return [{"year": year, "value": value} for year, value in sorted(out.items())]


def extract_wages(rows: list[dict[str, str]], *, real: bool) -> dict[str, dict[int, float]]:
    out: dict[str, dict[int, float]] = defaultdict(dict)
    for row in rows:
        if row["MEASURE"] != "WG" or row["PAY_PERIOD"] != "A":
            continue
        if row["AGGREGATION_OPERATION"] != "MEAN" or row["SEX"] != "_Z":
            continue
        if real:
            if row["UNIT_MEASURE"] != "USD_PPP" or row["PRICE_BASE"] != "Q" or row["BASE_PER"] != "2024":
                continue
        elif row["PRICE_BASE"] != "V":
            continue
        out[row["REF_AREA"]][int(row["TIME_PERIOD"])] = float(row["OBS_VALUE"])
    return dict(out)


def extract_housing(rows: list[dict[str, str]], measure: str) -> dict[str, dict[int, float]]:
    groups: dict[str, dict[tuple[str, str], dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for row in rows:
        if row["REF_AREA_TYPE"] != "COU" or row["FREQ"] != "A" or row["MEASURE"] != measure:
            continue
        if row["UNIT_MEASURE"] != "IX" or row["ADJUSTMENT"] != "N" or row["TRANSFORMATION"] != "_Z":
            continue
        groups[row["REF_AREA"]][(row["VINTAGE"], row["DWELLINGS"])][int(row["TIME_PERIOD"])] = float(row["OBS_VALUE"])

    priority = [
        ("_T", "_T"),
        ("EXISTING", "_T"),
        ("EXISTING", "SINGLE_F"),
        ("_T", "SINGLE_F"),
        ("EXISTING", "MULTI_F"),
        ("_T", "MULTI_F"),
        ("NEW", "_T"),
    ]
    out = {}
    for area, candidates in groups.items():
        chosen = None
        for key in priority:
            values = candidates.get(key)
            if values and 2008 in values and max(values) >= 2023:
                chosen = values
                break
        if chosen is None:
            valid = [values for values in candidates.values() if 2008 in values and max(values) >= 2023]
            chosen = max(valid, key=len) if valid else None
        if chosen:
            out[area] = chosen
    return out


def ratio_index(numerator: dict[int, float], denominator: dict[int, float]) -> dict[int, float]:
    num_index = indexed_map(numerator)
    den_index = indexed_map(denominator)
    return {
        year: num_index[year] / den_index[year]
        for year in sorted(set(num_index) & set(den_index))
    }


def add_summary(series: list[dict]) -> dict[str, float | int | None]:
    if not series:
        return {"latestYear": None, "latestValue": None}
    latest = max(series, key=lambda row: row["year"])
    return {"latestYear": latest["year"], "latestValue": latest["value"]}


def build_headline_lenses() -> list[dict]:
    ppp = load_world_bank("gdp-capita-ppp-international-usd-2021.csv")
    current = load_world_bank("gdp-capita-current-usd-2026.csv")
    return [
        {
            "id": "us-ppp",
            "label": "US GDP/cap, PPP",
            "region": "United States",
            "lens": "PPP",
            "values": indexed(ppp["USA"]),
        },
        {
            "id": "eu-ppp",
            "label": "Europe GDP/cap, PPP",
            "region": "Europe",
            "lens": "PPP",
            "values": mean_index(ppp, PROJECT_EUROPE),
        },
        {
            "id": "us-current",
            "label": "US GDP/cap, current USD",
            "region": "United States",
            "lens": "Current USD",
            "values": indexed(current["USA"]),
        },
        {
            "id": "eu-current",
            "label": "Europe GDP/cap, current USD",
            "region": "Europe",
            "lens": "Current USD",
            "values": mean_index(current, PROJECT_EUROPE),
        },
    ]


def build_pay_cost(wage_rows: list[dict[str, str]], housing_rows: list[dict[str, str]]) -> list[dict]:
    real_wages = extract_wages(wage_rows, real=True)
    nominal_wages = extract_wages(wage_rows, real=False)
    housing_cpi = extract_housing(housing_rows, "CPGRHO01")
    house_prices = extract_housing(housing_rows, "RHPI")

    eu_housing_vs_wage = {
        area: ratio_index(housing_cpi[area], nominal_wages[area])
        for area in OECD_HOUSING_EUROPE
        if area in housing_cpi and area in nominal_wages
    }
    eu_house_price_vs_wage = {
        area: ratio_index(house_prices[area], nominal_wages[area])
        for area in RHPI_EUROPE
        if area in house_prices and area in nominal_wages
    }

    return [
        {
            "id": "us-real-wage",
            "label": "US real average wage",
            "kind": "pay",
            "values": indexed(real_wages["USA"]),
        },
        {
            "id": "eu-real-wage",
            "label": "Europe real average wage",
            "kind": "pay",
            "values": mean_index(real_wages, PROJECT_EUROPE),
        },
        {
            "id": "us-housing-cpi-wage",
            "label": "US housing CPI / wage",
            "kind": "costPay",
            "values": [{"year": y, "value": v} for y, v in sorted(ratio_index(housing_cpi["USA"], nominal_wages["USA"]).items())],
        },
        {
            "id": "eu-housing-cpi-wage",
            "label": "Europe housing CPI / wage",
            "kind": "costPay",
            "values": mean_index(eu_housing_vs_wage, list(eu_housing_vs_wage)),
        },
        {
            "id": "us-house-price-wage",
            "label": "US house price / wage",
            "kind": "assetPay",
            "values": [{"year": y, "value": v} for y, v in sorted(ratio_index(house_prices["USA"], nominal_wages["USA"]).items())],
        },
        {
            "id": "eu-house-price-wage",
            "label": "Europe house price / wage",
            "kind": "assetPay",
            "values": mean_index(eu_house_price_vs_wage, list(eu_house_price_vs_wage)),
        },
    ]


def main() -> None:
    wage_rows = fetch_csv(OECD_WAGE_URL)
    housing_rows = fetch_csv(OECD_HOUSING_URL)
    headline_lenses = build_headline_lenses()
    pay_cost = build_pay_cost(wage_rows, housing_rows)
    payload = {
        "title": "Living cost and pay add-on",
        "baseYear": 2008,
        "sources": {
            "oecdAverageWages": OECD_WAGE_URL,
            "oecdHousePricesAndHousingCpi": OECD_HOUSING_URL,
            "worldBankGdpCapitaCurrentUsd": "data/worldbank/gdp-capita-current-usd-2026.csv",
            "worldBankGdpCapitaPpp": "data/worldbank/gdp-capita-ppp-international-usd-2021.csv",
        },
        "notes": [
            "All values are indexed to 2008 = 1.",
            "Europe is a simple average of available countries from the project sample, not an official EU aggregate.",
            "Real average wages use OECD annual average wages, USD PPP, constant 2024 prices.",
            "Housing CPI / wage divides each country's broad housing CPI index by its nominal average-wage index.",
            "House price / wage divides each country's residential house-price index by its nominal average-wage index.",
        ],
        "headlineLenses": headline_lenses,
        "payCost": pay_cost,
        "summary": {
            row["id"]: add_summary(row["values"])
            for row in [*headline_lenses, *pay_cost]
        },
    }
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
