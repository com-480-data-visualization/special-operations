#!/usr/bin/env python3

"""Fetch ECB household balance-sheet series for the narrative add-on."""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

import requests

OUTPUT_PATH = Path("public/ecb_household_assets.json")
BASE_PERIOD = "2008-Q4"
API_ROOT = "https://data-api.ecb.europa.eu/service/data"

SERIES = [
    {
        "id": "ecb-total-financial-assets",
        "label": "Euro area household financial asset stock",
        "dataset": "QSA",
        "key": "Q.N.I9.W0.S1M.S1.N.A.LE.F._Z._Z.XDC._T.S.V.N._T",
        "source_page": (
            "https://data.ecb.europa.eu/data/datasets/QSA/"
            "QSA.Q.N.I9.W0.S1M.S1.N.A.LE.F._Z._Z.XDC._T.S.V.N._T"
        ),
    },
    {
        "id": "ecb-net-worth-income-ratio",
        "label": "Euro area household net worth / disposable income",
        "dataset": "QSA",
        "key": "Q.N.I9.W0.S1M.S1._Z.B.B90._Z._Z._Z.XDC_R_B6G_CY._T.S.V.N._T",
        "source_page": (
            "https://data.ecb.europa.eu/data/datasets/QSA/"
            "QSA.Q.N.I9.W0.S1M.S1._Z.B.B90._Z._Z._Z.XDC_R_B6G_CY._T.S.V.N._T"
        ),
    },
]


def fetch_series(dataset: str, key: str) -> list[dict[str, float | str]]:
    url = f"{API_ROOT}/{dataset}/{key}?format=csvdata"
    response = requests.get(
        url,
        timeout=30,
        headers={
            "Accept": "text/csv,application/vnd.sdmx.data+csv;version=1.0.0",
            "User-Agent": "Mozilla/5.0",
        },
    )
    response.raise_for_status()
    reader = csv.DictReader(io.StringIO(response.text))
    return [
        {
            "period": row["TIME_PERIOD"],
            "value": float(row["OBS_VALUE"]),
        }
        for row in reader
        if row.get("TIME_PERIOD") and row.get("OBS_VALUE")
    ]


def main() -> None:
    payload = {
        "title": "ECB household balance-sheet add-on",
        "basePeriod": BASE_PERIOD,
        "source": "European Central Bank (ECB) Data Portal",
        "series": [],
    }

    for series in SERIES:
        points = fetch_series(series["dataset"], series["key"])
        payload["series"].append(
            {
                "id": series["id"],
                "label": series["label"],
                "dataset": series["dataset"],
                "seriesKey": f'{series["dataset"]}.{series["key"]}',
                "sourcePage": series["source_page"],
                "apiUrl": f'{API_ROOT}/{series["dataset"]}/{series["key"]}?format=csvdata',
                "points": points,
            }
        )

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
