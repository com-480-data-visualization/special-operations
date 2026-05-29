#!/usr/bin/env python3
"""Compare pre-2008 and post-2008 growth for major countries and regions."""

from __future__ import annotations

import json
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT_DIR / "public" / "spider_data.json"
PRE_START = 2000
BREAK_YEAR = 2008
POST_END = 2023
MAJOR_COUNTRIES = ["DEU", "FRA", "GBR", "USA", "JPN"]
REGIONS = ["Europe", "North America", "Asia-Pacific"]
METRICS = ["GDP", "GDP per Capita", "ETF Price", "Market Cap"]


def cagr(values: list[float | None], years: list[int], start: int, end: int):
    index = {year: i for i, year in enumerate(years)}
    start_value = values[index[start]]
    end_value = values[index[end]]
    if start_value is None or end_value is None or start_value <= 0 or end_value <= 0:
        return None
    multiple = end_value / start_value
    annualized = multiple ** (1 / (end - start)) - 1
    return multiple, annualized


def format_period(values: list[float | None], years: list[int], start: int, end: int) -> str:
    result = cagr(values, years, start, end)
    if result is None:
        return "n/a"
    multiple, annualized = result
    return f"{multiple:.2f}x ({annualized * 100:.2f}% CAGR)"


def print_section(title: str) -> None:
    print(f"\n{title}")
    print("-" * len(title))


def main() -> None:
    data = json.loads(DATA_PATH.read_text())
    years = data["years"]

    print_section("Major countries: pre-2008 vs post-2008")
    for iso3 in MAJOR_COUNTRIES:
        country = data["countries"][iso3]
        print(f"\n{iso3} - {country['name']}")
        for metric in METRICS:
            series = country["timeseries"].get(metric)
            if not series:
                continue
            pre = format_period(series["normalized"], years, PRE_START, BREAK_YEAR)
            post = format_period(series["normalized"], years, BREAK_YEAR, POST_END)
            print(f"{metric:15}  {PRE_START}-{BREAK_YEAR}: {pre:24}  {BREAK_YEAR}-{POST_END}: {post}")

    print_section("Region averages: pre-2008 vs post-2008")
    for region in REGIONS:
        region_series = data["regionsData"][region]["timeseries"]
        print(f"\n{region}")
        for metric in METRICS:
            series = region_series.get(metric)
            if not series:
                continue
            pre = format_period(series["normalized"], years, PRE_START, BREAK_YEAR)
            post = format_period(series["normalized"], years, BREAK_YEAR, POST_END)
            print(f"{metric:15}  {PRE_START}-{BREAK_YEAR}: {pre:24}  {BREAK_YEAR}-{POST_END}: {post}")

    print_section("Regional ETF benchmarks in setup")
    for region, metadata in data.get("benchmarkMetadata", {}).items():
        print(f"\n{region}: {metadata['fundName']} ({metadata['symbol']})")
        series = metadata.get("series")
        if not series:
            print("No local price series in repo.")
            print(f"Source: {metadata['officialUrl']}")
            continue
        years_start = series["startYear"]
        years_end = series["lastYear"]
        normalized = series["normalizedToStart"]
        pre_start = max(PRE_START, years_start)
        pre = format_period(normalized, years, pre_start, BREAK_YEAR)
        post = format_period(normalized, years, BREAK_YEAR, years_end)
        print(f"{pre_start}-{BREAK_YEAR}: {pre}")
        print(f"{BREAK_YEAR}-{years_end}: {post}")
        print(f"Source: {metadata['officialUrl']}")


if __name__ == "__main__":
    main()
