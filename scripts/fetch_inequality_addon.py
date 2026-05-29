#!/usr/bin/env python3

"""Fetch inequality add-on data from official sources."""

from __future__ import annotations

import csv
import io
import json
import zipfile
from pathlib import Path

import requests

OUTPUT_PATH = Path("public/inequality_addon.json")
USER_AGENT = "Mozilla/5.0"

FED_DFA_ZIP_URL = "https://www.federalreserve.gov/releases/z1/dataviz/download/zips/dfa.zip"
ECB_API_ROOT = "https://data-api.ecb.europa.eu/service/data"
ILO_LABOUR_SHARE_URL = "https://rplumber.ilo.org/data/indicator?id=LAP_2GDP_NOC_RT_A&format=.csv"

ECB_SERIES = {
    "top10": "DWA/Q.I9.S14._Z._Z.NWA.T10.PT.S.N",
    "bottom50": "DWA/Q.I9.S14._Z._Z.NWA.B50.PT.S.N",
}

CAPITAL_GAINS_VS_INCOME = [
    {
        "id": "usa",
        "label": "United States",
        "value": 24.0,
    },
    {
        "id": "ea20",
        "label": "Euro area",
        "value": 4.2,
    },
]

TOP10_CATEGORIES = {"TopPt1", "RemainingTop1", "Next9"}


def get_text(url: str, *, headers: dict[str, str] | None = None) -> str:
    response = requests.get(url, headers=headers or {"User-Agent": USER_AGENT}, timeout=60)
    response.raise_for_status()
    return response.text


def fetch_fed_wealth_shares() -> list[dict[str, float | str]]:
    response = requests.get(FED_DFA_ZIP_URL, headers={"User-Agent": USER_AGENT}, timeout=60)
    response.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        with archive.open("dfa-networth-shares.csv") as handle:
            reader = csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8"))
            rows_by_date: dict[str, dict[str, float]] = {}
            for row in reader:
                date = row["Date"].replace(":", "-")
                category = row["Category"]
                rows_by_date.setdefault(date, {"top10": 0.0, "bottom50": 0.0})
                if category in TOP10_CATEGORIES:
                    rows_by_date[date]["top10"] += float(row["Net worth"])
                elif category == "Bottom50":
                    rows_by_date[date]["bottom50"] = float(row["Net worth"])

    return [
        {
            "period": period,
            "top10": values["top10"],
            "bottom50": values["bottom50"],
        }
        for period, values in sorted(rows_by_date.items())
    ]


def fetch_ecb_wealth_shares() -> list[dict[str, float | str]]:
    series_rows: dict[str, dict[str, float]] = {}
    for key, path in ECB_SERIES.items():
        text = get_text(
            f"{ECB_API_ROOT}/{path}?format=csvdata",
            headers={
                "Accept": "text/csv,application/vnd.sdmx.data+csv;version=1.0.0",
                "User-Agent": USER_AGENT,
            },
        )
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            period = row["TIME_PERIOD"]
            series_rows.setdefault(period, {})
            series_rows[period][key] = float(row["OBS_VALUE"])

    return [
        {
            "period": period,
            "top10": values["top10"],
            "bottom50": values["bottom50"],
        }
        for period, values in sorted(series_rows.items())
        if "top10" in values and "bottom50" in values
    ]


def fetch_ilo_labour_share() -> list[dict[str, float | int | str]]:
    text = get_text(ILO_LABOUR_SHARE_URL)
    reader = csv.DictReader(io.StringIO(text))
    kept = []
    for row in reader:
        if row["ref_area"] not in {"USA", "X92"}:
            continue
        kept.append(
            {
                "area": row["ref_area"],
                "areaLabel": "United States" if row["ref_area"] == "USA" else "European Union 27",
                "year": int(row["time"]),
                "value": float(row["obs_value"]),
            }
        )
    return sorted(kept, key=lambda item: (item["area"], item["year"]))


def main() -> None:
    payload = {
        "title": "Inequality add-on",
        "sources": {
            "fedDfa": FED_DFA_ZIP_URL,
            "ecbDwaTop10": f"{ECB_API_ROOT}/{ECB_SERIES['top10']}?format=csvdata",
            "ecbDwaBottom50": f"{ECB_API_ROOT}/{ECB_SERIES['bottom50']}?format=csvdata",
            "iloLabourShare": ILO_LABOUR_SHARE_URL,
            "ecbCapitalGainsPaper": "https://www.ecb.europa.eu/press/key/date/2025/html/ecb.sp251009~49b985af53.en.pdf",
        },
        "wealthShares": {
            "usa": fetch_fed_wealth_shares(),
            "euroArea": fetch_ecb_wealth_shares(),
        },
        "capitalGainsVsIncome": CAPITAL_GAINS_VS_INCOME,
        "labourShare": fetch_ilo_labour_share(),
    }

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
