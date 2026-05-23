#!/usr/bin/env python3
"""Build treemap JSON from ACWI CSV snapshots and MSCI ACWI sector file.

Produces `public/treemap_data.json` with structure:
{
  "years": ["2015-04-01", ...],
  "data": { "2015-04-01": [ { "name": "United States", "value": 0.52, "sectors": {...} }, ... ] }
}

For 2015-2024, the country percentage columns in `msci_acwi_with_country_sectors.csv`
define the country treemap areas. Per-country sector columns are kept only for
country tooltips. The global `acwi_sector_*` columns define a second sector
treemap for the same snapshots.
"""
import csv
import json
import os
import re
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(ROOT, "data", "Market Capitalization")
OUT_PATH = os.path.join(ROOT, "public", "treemap_data.json")

MONTHS = {
    "jan": "01",
    "january": "01",
    "feb": "02",
    "february": "02",
    "mär": "03",
    "maerz": "03",
    "mar": "03",
    "march": "03",
    "apr": "04",
    "april": "04",
    "mai": "05",
    "may": "05",
    "jun": "06",
    "june": "06",
    "jul": "07",
    "july": "07",
    "aug": "08",
    "august": "08",
    "sep": "09",
    "sept": "09",
    "september": "09",
    "oct": "10",
    "okt": "10",
    "october": "10",
    "nov": "11",
    "november": "11",
    "dec": "12",
    "dez": "12",
    "december": "12",
}

SECTOR_LABELS = {
    "financials": "Financials",
    "it": "Information Technology",
    "consdisc": "Consumer Discretionary",
    "healthcare": "Health Care",
    "industrials": "Industrials",
    "consstaples": "Consumer Staples",
    "energy": "Energy",
    "materials": "Materials",
    "telecom_commsrvcs": "Communication Services",
    "utilities": "Utilities",
    "realestate": "Real Estate",
}

COUNTRY_PCT_COLS = [
    "usa_pct",
    "japan_pct",
    "uk_pct",
    "france_pct",
    "switzerland_pct",
    "canada_pct",
    "china_pct",
    "other_pct",
]

COUNTRY_LABELS = {
    "usa": "United States",
    "uk": "United Kingdom",
    "japan": "Japan",
    "france": "France",
    "switzerland": "Switzerland",
    "canada": "Canada",
    "china": "China",
    "other": "Other",
}

COUNTRY_NAME_MAP = {
    "vereinigte staaten": "United States",
    "usa": "United States",
    "united states": "United States",
    "vereinigtes königreich": "United Kingdom",
    "vereinigtes koenigreich": "United Kingdom",
    "uk": "United Kingdom",
    "united kingdom": "United Kingdom",
    "deutschland": "Germany",
    "germany": "Germany",
    "frankreich": "France",
    "schweiz": "Switzerland",
    "kanada": "Canada",
    "japan": "Japan",
    "china": "China",
    "irland": "Ireland",
    "niederlande": "Netherlands",
    "korea": "South Korea",
    "australien": "Australia",
    "spanien": "Spain",
    "dänemark": "Denmark",
    "daenemark": "Denmark",
    "italien": "Italy",
    "hongkong": "Hong Kong",
    "singapur": "Singapore",
    "schweden": "Sweden",
    "südafrika": "South Africa",
    "suedafrika": "South Africa",
    "belgien": "Belgium",
    "finnland": "Finland",
    "indonesien": "Indonesia",
    "österreich": "Austria",
    "oesterreich": "Austria",
    "polen": "Poland",
    "israel": "Israel",
    "ungarn": "Hungary",
    "kuwait": "Kuwait",
    "mexiko": "Mexico",
    "qatar": "Qatar",
    "europäische union": "European Union",
    "europaeische union": "European Union",
    "thailand": "Thailand",
    "norwegen": "Norway",
}

def parse_number_eu(s):
    """Parse numbers like '1.253.680.788,50' or '123,45' into float."""
    if s is None:
        return 0.0
    s = s.strip()
    if s == "":
        return 0.0
    # remove non-breaking spaces
    s = s.replace('\u00A0', '')
    # If string contains both '.' and ',', assume European formatting
    if s.count('.') > 0 and s.count(',') > 0:
        s = s.replace('.', '').replace(',', '.')
    else:
        s = s.replace(',', '.')
    try:
        return float(s)
    except Exception:
        return 0.0

def normalize_sector_name(raw):
    """Map MSCI and German iShares sector labels to readable names."""
    if not raw:
        return "Other"
    s = raw.strip().replace('\u00A0', ' ')
    key = s.lower().replace(" ", "_")
    if key in SECTOR_LABELS:
        return SECTOR_LABELS[key]
    if "it" == key or "information" in key:
        return "Information Technology"
    if "finanz" in key or "financial" in key or "bank" in key:
        return "Financials"
    if "zyklische" in s.lower() or "discretionary" in key:
        return "Consumer Discretionary"
    if "nichtzyklische" in s.lower() or "staples" in key:
        return "Consumer Staples"
    if "gesundheit" in key or "health" in key:
        return "Health Care"
    if "industrie" in key or "industrial" in key:
        return "Industrials"
    if "energie" in key or "energy" in key:
        return "Energy"
    if "material" in key:
        return "Materials"
    if "kommunikation" in key or "communication" in key or "telecom" in key:
        return "Communication Services"
    if "immobil" in key or "real_estate" in key:
        return "Real Estate"
    if "versorg" in key or "utilit" in key:
        return "Utilities"
    return s

def normalize_country_name(raw):
    """Map country names from mixed German/English sources to English labels."""
    name = (raw or "").strip().replace('\u00A0', ' ')
    key = re.sub(r'\s+', ' ', name).lower()
    return COUNTRY_NAME_MAP.get(key, name)

def parse_snapshot_date(raw):
    """Return (iso_key, label, year) for mixed English/German date strings."""
    text = (raw or "").strip().replace("\ufeff", "").replace('"', "")
    text = re.sub(r'\s+', ' ', text)

    m = re.search(r'(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\.?\s*(20\d{2})', text)
    if m:
        day, month_name, year = m.groups()
        month = MONTHS.get(month_name.lower(), "01")
        return f"{year}-{month}-{int(day):02d}", f"{int(day)} {month_name} {year}", year

    m = re.search(r'([A-Za-zÄÖÜäöü]+)\s+(\d{1,2})\s+(20\d{2})', text)
    if m:
        month_name, day, year = m.groups()
        month = MONTHS.get(month_name.lower(), "01")
        return f"{year}-{month}-{int(day):02d}", f"{month_name} {int(day)} {year}", year

    m = re.search(r'([A-Za-zÄÖÜäöü]+)\s+(20\d{2})', text)
    if m:
        month_name, year = m.groups()
        month = MONTHS.get(month_name.lower(), "01")
        return f"{year}-{month}-01", f"{month_name} {year}", year

    m = re.search(r'(20\d{2})', text)
    if m:
        year = m.group(1)
        return f"{year}-01-01", year, year

    return text, text, text[-4:]

def process_msci_acwi(path):
    """Read msci_acwi_with_country_sectors.csv and produce dict by year."""
    results = {}
    with open(path, newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        sector_col_re = re.compile(r'^(?P<country>[^,]+)_sec_(?P<sector>.+)$')
        cols = reader.fieldnames
        if not cols:
            return results
        country_pct_cols = [c for c in COUNTRY_PCT_COLS if c in cols]
        global_sector_col_re = re.compile(r'^acwi_sector_(?P<sector>.+)$')
        global_sector_cols = [c for c in cols if global_sector_col_re.match(c)]
        sector_cols = [
            c for c in cols
            if sector_col_re.match(c) and not c.startswith("acwi_sector_")
        ]
        # Map columns -> (country, sector)
        mapping = {}
        for c in sector_cols:
            m = sector_col_re.match(c)
            if m:
                mapping[c] = (m.group('country'), m.group('sector'))

        for row in reader:
            date_raw = row.get('date') or row.get('Date')
            if not date_raw:
                continue
            key, label, year = parse_snapshot_date(date_raw)

            # parse country pct
            country_pct = {}
            for c in country_pct_cols:
                country = c.replace('_pct','')
                v = (row.get(c) or '').strip()
                try:
                    country_pct[country] = float(v) if v!='' else 0.0
                except Exception:
                    country_pct[country] = parse_number_eu(v)

            global_sectors = {}
            for col in global_sector_cols:
                raw = (row.get(col) or '').strip()
                if raw == '':
                    continue
                try:
                    val = float(raw)
                except Exception:
                    val = parse_number_eu(raw)
                sector_match = global_sector_col_re.match(col)
                if sector_match and val > 0:
                    global_sectors[normalize_sector_name(sector_match.group('sector'))] = val

            # build country->sector as dict for tooltip
            country_sector = defaultdict(dict)
            for col, (country, sector) in mapping.items():
                raw = (row.get(col) or '').strip()
                if raw == '':
                    continue
                try:
                    val = float(raw)
                except Exception:
                    val = parse_number_eu(raw)
                country_sector[country][normalize_sector_name(sector)] = val

            # Output countries as treemap leaves. Sector values stay metadata for tooltips.
            out = []
            for country, pct in country_pct.items():
                if pct > 0:
                    out.append({
                        "name": normalize_country_name(
                            COUNTRY_LABELS.get(country, country.title().replace('_',' '))
                        ),
                        "value": pct,
                        "sectors": dict(country_sector.get(country, {})),
                    })
            results[key] = {
                "label": label,
                "year": year,
                "items": out,
                "sectorItems": [
                    {"name": sector, "value": value}
                    for sector, value in global_sectors.items()
                ],
            }
    return results

def process_acwi_snapshot(path):
    """Aggregate holdings CSV snapshot into country -> sector sums. Returns dict for that snapshot year."""
    agg = defaultdict(lambda: defaultdict(float))
    sector_totals = defaultdict(float)
    with open(path, newline='', encoding='utf-8-sig') as fh:
        lines = fh.readlines()

    key, label, year = parse_snapshot_date(lines[0] if lines else "")
    header_idx = next(
        (idx for idx, line in enumerate(lines) if "Emittententicker" in line or "Ticker" in line),
        0,
    )

    reader = csv.DictReader(lines[header_idx:])
    if reader.fieldnames:
        for row in reader:
            raw_value = row.get('Gewichtung (%)') or row.get('Weight (%)') or row.get('Marktwert') or row.get('Market value')
            if raw_value is None:
                continue
            mv = parse_number_eu(raw_value)
            country = row.get('Standort') or row.get('Location') or row.get('Standort / Country') or ''
            sector = row.get('Sektor') or row.get('Sector') or ''
            country = country.strip()
            sector = normalize_sector_name(sector)
            if country == '':
                continue
            agg[country][sector] += mv
            sector_totals[sector] += mv

    if not re.search(r'20\d{2}', year or ""):
        m = re.search(r'(20\d{2})', os.path.basename(path))
        year = m.group(1) if m else '2025'
        key = f"{year}-01-01"
        label = year

    out = []
    for country, sectors in agg.items():
        total = sum(val for val in sectors.values() if val > 0)
        if total > 0:
            out.append({
                "name": normalize_country_name(country),
                "value": total,
                "sectors": {
                    sector: (val / total) * 100
                    for sector, val in sectors.items()
                    if val > 0
                },
            })
    return key, {
        "label": label,
        "year": year,
        "items": out,
        "sectorItems": [
            {"name": sector, "value": value}
            for sector, value in sector_totals.items()
            if value > 0
        ],
    }

def normalize_and_write(all_data, out_path):
    # all_data: dict snapshot key -> {label, year, items}
    years = sorted(all_data.keys())
    payload = {"years": years, "snapshots": [], "data": {}, "sectorData": {}}
    # Normalize country areas within each snapshot. Sector values remain tooltip percentages.
    for key in years:
        snapshot = all_data[key]
        items = snapshot.get("items", snapshot if isinstance(snapshot, list) else [])
        total = sum(c.get("value", 0.0) for c in items)
        # avoid division by zero
        if total <= 0:
            payload['data'][key] = items
            continue
        normalized = []
        for c in items:
            normalized.append({
                "name": c['name'],
                "value": c.get("value", 0.0) / total,
                "sectors": c.get("sectors", {}),
            })
        payload['data'][key] = normalized
        sector_items = snapshot.get("sectorItems", [])
        sector_total = sum(s.get("value", 0.0) for s in sector_items)
        payload["sectorData"][key] = [
            {
                "name": s["name"],
                "value": s.get("value", 0.0) / sector_total,
            }
            for s in sector_items
            if sector_total > 0 and s.get("value", 0.0) > 0
        ]
        payload["snapshots"].append({
            "key": key,
            "label": snapshot.get("label", key),
            "year": snapshot.get("year", key[:4]),
        })

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)

def main():
    msci_path = os.path.join(DATA_DIR, 'msci_acwi_with_country_sectors.csv')
    acwi_2025 = os.path.join(DATA_DIR, 'ACWI2025Dec.csv')
    acwi_2026 = os.path.join(DATA_DIR, 'ACWI2026May.csv')

    all_data = {}
    if os.path.exists(msci_path):
        print('Processing', msci_path)
        d = process_msci_acwi(msci_path)
        all_data.update(d)

    if os.path.exists(acwi_2025):
        print('Processing', acwi_2025)
        key, snapshot = process_acwi_snapshot(acwi_2025)
        all_data[key] = snapshot

    if os.path.exists(acwi_2026):
        print('Processing', acwi_2026)
        key, snapshot = process_acwi_snapshot(acwi_2026)
        all_data[key] = snapshot

    print('Normalizing and writing', OUT_PATH)
    normalize_and_write(all_data, OUT_PATH)
    print('Done.')

if __name__ == '__main__':
    main()
