#!/usr/bin/env python3

"""Build exploratory analysis cards for the narrative lab."""

from __future__ import annotations

import csv
import io
import json
import math
from itertools import combinations
from pathlib import Path
from statistics import mean
from urllib.request import Request, urlopen

SPIDER_PATH = Path("public/spider_data.json")
INEQUALITY_PATH = Path("public/inequality_addon.json")
OUTPUT_PATH = Path("public/analysis_lab_data.json")
DATA_DIR = Path("data")

REGIONS = ["North America", "Europe", "Asia-Pacific", "Latin America"]
REGION_LABELS = {
    "North America": "North America",
    "Europe": "Europe",
    "Asia-Pacific": "Asia-Pacific",
    "Latin America": "Latin America",
}
METRICS = ["GDP per Capita", "ETF Price", "Market Cap"]
COLORS = {
    "United States": "#ff9f9a",
    "Europe": "#7dc4ff",
    "North America": "#c7d2fe",
    "Asia-Pacific": "#65d6ad",
    "Latin America": "#f7c66b",
}
STRUCTURE_INDICATORS = [
    ("manufacturing", "Manufacturing", "NV.IND.MANF.ZS", "% GDP"),
    ("industry", "Industry", "NV.IND.TOTL.ZS", "% GDP"),
    ("services", "Services", "NV.SRV.TOTL.ZS", "% GDP"),
    ("investment", "Investment", "NE.GDI.TOTL.ZS", "% GDP"),
    ("research", "R&D", "GB.XPD.RSDV.GD.ZS", "% GDP"),
]


def fetch_csv(url: str) -> list[dict[str, str]]:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=45) as response:
        text = response.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def load_world_bank_file(filename: str, years: list[int]) -> dict[str, dict[int, float]]:
    path = DATA_DIR / "worldbank" / filename
    with path.open(encoding="utf-8-sig") as handle:
        lines = handle.readlines()[4:]
    rows = csv.DictReader(lines)
    output: dict[str, dict[int, float]] = {}
    for row in rows:
        code = row.get("Country Code")
        if not code:
            continue
        values = {}
        for year in years:
            raw = row.get(str(year))
            if raw not in (None, ""):
                values[year] = float(raw)
        output[code] = values
    return output


def series(spider: dict, source: str, key: str, metric: str, kind: str = "normalized") -> list[float | None]:
    if source == "country":
        return spider["countries"][key]["timeseries"][metric][kind]
    return spider["regionsData"][key]["timeseries"][metric][kind]


def ratio_since(values: list[float | None], years: list[int], base_year: int, latest_year: int) -> float | None:
    base = values[years.index(base_year)]
    latest = values[years.index(latest_year)]
    if base is None or latest is None or base <= 0:
        return None
    return latest / base


def linear_fit(xs: list[float], ys: list[float]) -> tuple[float, float]:
    xbar = mean(xs)
    ybar = mean(ys)
    denom = sum((x - xbar) ** 2 for x in xs)
    if denom == 0:
        return ybar, 0.0
    slope = sum((x - xbar) * (y - ybar) for x, y in zip(xs, ys)) / denom
    return ybar - slope * xbar, slope


def break_bic(years: list[int], gap: list[float], break_year: int) -> float:
    xs = [float(year) for year in years]
    ys = gap
    # least squares with [1, year, max(0, year-break)] by tiny normal equations
    columns = [
        [1.0 for _ in xs],
        [x - years[0] for x in xs],
        [max(0.0, x - break_year) for x in xs],
    ]
    xtx = [[sum(a * b for a, b in zip(c1, c2)) for c2 in columns] for c1 in columns]
    xty = [sum(c * y for c, y in zip(col, ys)) for col in columns]
    beta = solve_3x3(xtx, xty)
    residuals = [
        y - sum(beta[j] * columns[j][i] for j in range(3))
        for i, y in enumerate(ys)
    ]
    rss = max(sum(resid * resid for resid in residuals), 1e-12)
    n = len(ys)
    k = 3
    return n * math.log(rss / n) + k * math.log(n)


def solve_3x3(matrix: list[list[float]], vector: list[float]) -> list[float]:
    a = [row[:] + [value] for row, value in zip(matrix, vector)]
    for col in range(3):
        pivot = max(range(col, 3), key=lambda row: abs(a[row][col]))
        a[col], a[pivot] = a[pivot], a[col]
        div = a[col][col] or 1e-12
        a[col] = [value / div for value in a[col]]
        for row in range(3):
            if row == col:
                continue
            factor = a[row][col]
            a[row] = [value - factor * pivot_value for value, pivot_value in zip(a[row], a[col])]
    return [a[row][3] for row in range(3)]


def build_break_finder(spider: dict) -> list[dict]:
    years = spider["years"]
    output = []
    configs = [
        ("GDP/cap gap", "GDP per Capita"),
        ("ETF gap", "ETF Price"),
        ("Market-cap gap", "Market Cap"),
    ]
    for label, metric in configs:
        us = series(spider, "country", "USA", metric)
        eu = series(spider, "region", "Europe", metric)
        valid = [
            (year, math.log(u) - math.log(e))
            for year, u, e in zip(years, us, eu)
            if u is not None and e is not None and u > 0 and e > 0
        ]
        gap_years = [item[0] for item in valid]
        gap = [item[1] for item in valid]
        rows = []
        for break_year in range(2005, 2016):
            bic = break_bic(gap_years, gap, break_year)
            rows.append({"year": break_year, "bic": bic})
        max_bic = max(row["bic"] for row in rows)
        min_bic = min(row["bic"] for row in rows)
        for row in rows:
            row["score"] = (max_bic - row["bic"]) / (max_bic - min_bic or 1)
        best = min(rows, key=lambda row: row["bic"])
        output.append({"metric": label, "bestYear": best["year"], "scores": rows})
    return output


def build_heatmap(spider: dict) -> dict:
    years = spider["years"]
    latest = spider["latestYear"]
    cells = []
    for metric in METRICS:
        multiples = {
            region: ratio_since(series(spider, "region", region, metric), years, 2008, latest)
            for region in REGIONS
        }
        for a, b in combinations(REGIONS, 2):
            if multiples[a] is None or multiples[b] is None:
                continue
            cells.append({
                "metric": metric,
                "a": a,
                "b": b,
                "value": abs(math.log(multiples[a] / multiples[b])),
                "aMultiple": multiples[a],
                "bMultiple": multiples[b],
            })
    return {"regions": REGIONS, "cells": cells}


def build_divergence_timeline(spider: dict) -> list[dict]:
    years = spider["years"]
    rows = []
    for label, metric in [("GDP/cap gap", "GDP per Capita"), ("ETF gap", "ETF Price"), ("Market-cap gap", "Market Cap")]:
        us = series(spider, "country", "USA", metric)
        eu = series(spider, "region", "Europe", metric)
        base_index = years.index(2008)
        base = us[base_index] / eu[base_index]
        values = [
            {"year": year, "value": (u / e) / base if u and e else None}
            for year, u, e in zip(years, us, eu)
        ]
        rows.append({"label": label, "values": values})
    return rows


def build_pre_story(spider: dict) -> dict:
    years = spider["years"]
    growth_metrics = [
        ("GDP/cap", "GDP per Capita"),
        ("GDP", "GDP"),
        ("Market proxy", "ETF Price"),
        ("Listed value", "Market Cap"),
    ]
    growth = []
    for label, metric in growth_metrics:
        growth.append({
            "label": label,
            "metric": metric,
            "us": ratio_since(series(spider, "country", "USA", metric), years, 2000, 2008),
            "europe": ratio_since(series(spider, "region", "Europe", metric), years, 2000, 2008),
        })
    return {
        "growth": growth,
        "runup": build_pre_break_runup(spider),
        "industrialStructure": build_industrial_structure(),
    }


def build_real_adjusted_explorer(spider: dict) -> dict:
    years = spider["years"]
    configs = [
        ("us-gdp-capita", "country", "USA", "GDP per Capita"),
        ("eu-gdp-capita", "region", "Europe", "GDP per Capita"),
        ("na-gdp-capita", "region", "North America", "GDP per Capita"),
        ("asia-gdp-capita", "region", "Asia-Pacific", "GDP per Capita"),
        ("la-gdp-capita", "region", "Latin America", "GDP per Capita"),
        ("us-etf", "country", "USA", "ETF Price"),
        ("eu-etf", "region", "Europe", "ETF Price"),
        ("us-market-cap", "country", "USA", "Market Cap"),
        ("eu-market-cap", "region", "Europe", "Market Cap"),
    ]
    out = {}
    for series_id, source, key, metric in configs:
        values = series(spider, source, key, metric, "absolute")
        if values and any(value is not None for value in values):
            out[series_id] = {
                "values": values,
                "method": adjustment_method(metric),
            }
    return {
        "series": out,
        "unitNote": "All explorer series use the same preprocessing basis: GDP/GDP-cap are World Bank constant 2021 PPP international-dollar series; ETF and market-cap proxies are nominal USD valuation series scaled by each economy's PPP-constant-GDP/current-GDP conversion factor.",
    }


def mean_available(values: list[float | None]) -> float | None:
    clean = [value for value in values if value is not None]
    return mean(clean) if clean else None


def sum_available(values: list[float | None]) -> float | None:
    clean = [value for value in values if value is not None]
    return sum(clean) if clean else None


def adjustment_method(metric: str) -> str:
    if metric == "GDP per Capita":
        return "World Bank GDP per capita, PPP (constant 2021 international $)."
    if metric == "GDP":
        return "World Bank GDP, PPP (constant 2021 international $)."
    return "Nominal USD valuation series multiplied by World Bank PPP-constant-GDP/current-GDP conversion factor during preprocessing."


def build_pre_break_runup(spider: dict) -> list[dict]:
    years = spider["years"]
    rows = []
    for label, metric in [
        ("GDP/cap", "GDP per Capita"),
        ("ETF proxy", "ETF Price"),
        ("Listed value", "Market Cap"),
    ]:
        us = series(spider, "country", "USA", metric)
        eu = series(spider, "region", "Europe", metric)
        rows.append({
            "label": label,
            "metric": metric,
            "us2007": us[years.index(2007)],
            "us2008": us[years.index(2008)],
            "europe2007": eu[years.index(2007)],
            "europe2008": eu[years.index(2008)],
            "usBreakDelta": ratio_between(us, years, 2007, 2008),
            "europeBreakDelta": ratio_between(eu, years, 2007, 2008),
        })
    return rows


def ratio_between(values: list[float | None], years: list[int], start_year: int, end_year: int) -> float | None:
    start = values[years.index(start_year)]
    end = values[years.index(end_year)]
    if start is None or end is None or start <= 0:
        return None
    return end / start - 1


def build_industrial_structure() -> list[dict]:
    rows = []
    for key, label, indicator, unit in STRUCTURE_INDICATORS:
        records = fetch_world_bank_indicator(indicator, "2000:2008")
        us = latest_value(records, "USA", 2008)
        eu = latest_value(records, "EUU", 2008)
        if us is None and eu is None:
            continue
        rows.append({
            "key": key,
            "label": label,
            "indicator": indicator,
            "unit": unit,
            "us": us["value"] if us else None,
            "usYear": us["year"] if us else None,
            "europe": eu["value"] if eu else None,
            "europeYear": eu["year"] if eu else None,
        })
    return rows


def latest_value(records: list[dict], code: str, max_year: int) -> dict | None:
    values = [
        {"year": row["year"], "value": row["value"]}
        for row in records
        if row["code"] == code and row["year"] <= max_year and row["value"] is not None
    ]
    if not values:
        return None
    return max(values, key=lambda row: row["year"])


def build_archetypes(spider: dict) -> list[dict]:
    years = spider["years"]
    latest = spider["latestYear"]
    rows = []
    for region in REGIONS:
        gdp_pc = ratio_since(series(spider, "region", region, "GDP per Capita"), years, 2008, latest)
        market = ratio_since(series(spider, "region", region, "ETF Price"), years, 2008, latest)
        gdp_abs = series(spider, "region", region, "GDP", "absolute")[years.index(latest)]
        rows.append({
            "region": region,
            "label": REGION_LABELS[region],
            "gdpPerCapitaMultiple": gdp_pc,
            "marketMultiple": market,
            "gdp": gdp_abs,
            "color": COLORS[region],
        })
    rows.append({
        "region": "United States",
        "label": "United States",
        "gdpPerCapitaMultiple": ratio_since(series(spider, "country", "USA", "GDP per Capita"), years, 2008, latest),
        "marketMultiple": ratio_since(series(spider, "country", "USA", "ETF Price"), years, 2008, latest),
        "gdp": series(spider, "country", "USA", "GDP", "absolute")[years.index(latest)],
        "color": COLORS["United States"],
    })
    return rows


def build_counterfactual(spider: dict) -> list[dict]:
    years = spider["years"]
    rows = []
    for label, source, key, metric, color in [
        ("US GDP/cap", "country", "USA", "GDP per Capita", COLORS["United States"]),
        ("Europe GDP/cap", "region", "Europe", "GDP per Capita", COLORS["Europe"]),
        ("US ETF", "country", "USA", "ETF Price", "#ffcf9f"),
        ("Europe ETF", "region", "Europe", "ETF Price", "#8bd7ff"),
    ]:
        values = series(spider, source, key, metric)
        fit_points = [
            (year, math.log(value))
            for year, value in zip(years, values)
            if 2000 <= year <= 2008 and value is not None and value > 0
        ]
        intercept, slope = linear_fit([x for x, _ in fit_points], [y for _, y in fit_points])
        base = values[years.index(2008)]
        actual = []
        trend = []
        for year, value in zip(years, values):
            if year < 2008 or value is None or value <= 0 or base is None:
                continue
            actual.append({"year": year, "value": value / base})
            trend_value = math.exp(intercept + slope * year) / base
            trend.append({"year": year, "value": trend_value})
        rows.append({"label": label, "color": color, "actual": actual, "trend": trend})
    return rows


def build_scorecard(spider: dict, inequality: dict) -> list[dict]:
    years = spider["years"]
    latest = spider["latestYear"]
    happiness = fetch_happiness()
    life = fetch_world_bank_life()
    return [
        {
            "region": "United States",
            "gdpPerCapita": ratio_since(series(spider, "country", "USA", "GDP per Capita"), years, 2008, latest),
            "market": ratio_since(series(spider, "country", "USA", "ETF Price"), years, 2008, latest),
            "capitalGainsIncome": 24.0,
            "labourShareDelta": labour_delta(inequality, "USA"),
            "lifeExpectancyDelta": life["USA"],
            "happinessDelta": happiness["USA"],
        },
        {
            "region": "Europe",
            "gdpPerCapita": ratio_since(series(spider, "region", "Europe", "GDP per Capita"), years, 2008, latest),
            "market": ratio_since(series(spider, "region", "Europe", "ETF Price"), years, 2008, latest),
            "capitalGainsIncome": 4.2,
            "labourShareDelta": labour_delta(inequality, "X92"),
            "lifeExpectancyDelta": life["EUU"],
            "happinessDelta": happiness["EU27"],
        },
    ]


def build_labour_share_trends(inequality: dict) -> list[dict]:
    rows = []
    for area, label, color in [
        ("USA", "United States", COLORS["United States"]),
        ("X92", "EU-27", COLORS["Europe"]),
    ]:
        values = sorted(
            [{"year": row["year"], "value": row["value"]} for row in inequality["labourShare"] if row["area"] == area],
            key=lambda row: row["year"],
        )
        rows.append({
            "area": area,
            "label": label,
            "color": color,
            "values": values,
            "preSlope": labour_slope(values, 2004, 2008),
            "postSlope": labour_slope(values, 2008, 2025),
            "preDelta": labour_delta_between(values, 2004, 2008),
            "postDelta": labour_delta_between(values, 2008, 2025),
        })
    return rows


def labour_slope(values: list[dict], start_year: int, end_year: int) -> float | None:
    points = [(row["year"], row["value"]) for row in values if start_year <= row["year"] <= end_year]
    if len(points) < 2:
        return None
    _, slope = linear_fit([year for year, _ in points], [value for _, value in points])
    return slope


def labour_delta_between(values: list[dict], start_year: int, end_year: int) -> float | None:
    by_year = {row["year"]: row["value"] for row in values}
    if start_year not in by_year or end_year not in by_year:
        return None
    return by_year[end_year] - by_year[start_year]


def labour_delta(inequality: dict, area: str) -> float:
    rows = [row for row in inequality["labourShare"] if row["area"] == area]
    start = next(row for row in rows if row["year"] == 2008)
    end = next((row for row in rows if row["year"] == 2025), rows[-1])
    return end["value"] - start["value"]


def fetch_world_bank_life() -> dict[str, float]:
    url = "https://api.worldbank.org/v2/country/USA;EUU/indicator/SP.DYN.LE00.IN?format=json&per_page=20000&date=2008:2024"
    data = json.loads(fetch_url(url))[1]
    by_code: dict[str, dict[int, float]] = {}
    for row in data:
        value = row.get("value")
        if value is None:
            continue
        code = row["countryiso3code"] or row["country"]["id"]
        by_code.setdefault(code, {})[int(row["date"])] = float(value)
    return {code: values[max(values)] - values[2008] for code, values in by_code.items()}


def fetch_world_bank_indicator(indicator: str, date: str) -> list[dict]:
    url = f"https://api.worldbank.org/v2/country/USA;EUU/indicator/{indicator}?format=json&per_page=20000&date={date}"
    try:
        data = json.loads(fetch_url(url))[1]
    except Exception:
        return []
    rows = []
    for row in data:
        value = row.get("value")
        if value is None:
            continue
        code = row.get("countryiso3code") or row["country"]["id"]
        rows.append({"code": code, "year": int(row["date"]), "value": float(value)})
    return rows


def fetch_happiness() -> dict[str, float]:
    rows = fetch_csv("https://ourworldindata.org/grapher/happiness-cantril-ladder.csv")
    eu_codes = {
        "AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "IRL",
        "ITA", "LVA", "LTU", "LUX", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE",
    }
    by_year: dict[str, dict[int, list[float]]] = {"USA": {}, "EU27": {}}
    for row in rows:
        code = row["Code"]
        year = int(row["Year"])
        value = float(row["Self-reported life satisfaction"])
        if code == "USA":
            by_year["USA"].setdefault(year, []).append(value)
        elif code in eu_codes:
            by_year["EU27"].setdefault(year, []).append(value)
    out = {}
    for group, values in by_year.items():
        start = mean(values[2012])
        end_year = max(values)
        out[group] = mean(values[end_year]) - start
    return out


def fetch_url(url: str) -> str:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=45) as response:
        return response.read().decode("utf-8")


def main() -> None:
    spider = json.loads(SPIDER_PATH.read_text())
    inequality = json.loads(INEQUALITY_PATH.read_text())
    payload = {
        "baselineYear": spider["baselineYear"],
        "latestYear": spider["latestYear"],
        "scorecardYears": {"start": 2008, "end": spider["latestYear"]},
        "scorecardUnits": {
            "gdpPerCapita": "GDP per capita, PPP (constant 2021 international $)",
            "market": "ETF price proxy, normalized multiple",
            "capitalGainsIncome": "average annual capital gains as percent of household disposable income",
            "labourShareDelta": "percentage-point change in labour share of GDP",
            "lifeExpectancyDelta": "change in years",
            "happinessDelta": "change in Cantril ladder score",
        },
        "realAdjustedExplorer": build_real_adjusted_explorer(spider),
        "preStory": build_pre_story(spider),
        "breakFinder": build_break_finder(spider),
        "heatmap": build_heatmap(spider),
        "timeline": build_divergence_timeline(spider),
        "archetypes": build_archetypes(spider),
        "counterfactual": build_counterfactual(spider),
        "scorecard": build_scorecard(spider, inequality),
        "labourShareTrends": build_labour_share_trends(inequality),
        "gainMatrix": {
            "capitalGainsIncome": {"United States": 24.0, "Europe": 4.2},
            "labourShareDelta": {
                "United States": labour_delta(inequality, "USA"),
                "Europe": labour_delta(inequality, "X92"),
            },
        },
    }
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
