#!/usr/bin/env python3

"""Regenerate milestone 1 availability figures in site style."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import subprocess

import pandas as pd


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"
WORLD_BANK_HEADER_SIZE = 4
ETF_DIR = DATA_DIR / "nasdaq" / "etf"
TOP25_SOURCE = DATA_DIR / "worldbank" / "gdp-current-usd-2026.csv"

FONT_STACK = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
COLORS = {
    "bg0": "#05070d",
    "bg1": "#0a0e18",
    "surface": "#0f1420",
    "surface_strong": "#0b0f1a",
    "hairline": "#ffffff",
    "text": "#f3f6fc",
    "text_secondary": "#b6c0d3",
    "text_tertiary": "#7e8aa1",
    "accent": "#6fa1ff",
    "accent_alt": "#7dc4ff",
    "accent_soft": "#1a2742",
    "available_stroke": "#9fc5ff",
    "missing": "#131a29",
    "missing_stroke": "#1a2437",
}

ETF_PROXY_SYMBOLS = {
    "AUS": "EWA",
    "CAN": "EWC",
    "SWE": "EWD",
    "DEU": "EWG",
    "ITA": "EWI",
    "JPN": "EWJ",
    "BEL": "EWK",
    "CHE": "EWL",
    "MEX": "EWW",
    "NLD": "EWN",
    "ESP": "EWP",
    "FRA": "EWQ",
    "GBR": "EWU",
    "KOR": "EWY",
    "BRA": "EWZ",
}


@dataclass(frozen=True)
class FigureSpec:
    stem: str
    title: str
    subtitle: str


@dataclass(frozen=True)
class AvailabilityDataset:
    spec: FigureSpec
    countries: list[str]
    years: list[int]
    availability: pd.DataFrame


FIGURES = [
    FigureSpec(
        stem="market_cap_availability",
        title="Market Cap Data Availability Timeline",
        subtitle="Top 25 countries by 2024 GDP. Rows sorted by 2024 GDP; cells show whether the World Bank market-cap series is present in that year.",
    ),
    FigureSpec(
        stem="gdp_availability",
        title="GDP Data Availability Timeline",
        subtitle="Top 25 countries by 2024 GDP. Rows sorted by 2024 GDP; cells show whether the World Bank current-USD GDP series is present in that year.",
    ),
    FigureSpec(
        stem="etf_availability",
        title="ETF Data Availability Timeline",
        subtitle="Top 25 countries by 2024 GDP. Rows sorted by 2024 GDP; cells show whether the milestone ETF proxy bundle has any daily observations in that calendar year.",
    ),
]


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return (
        int(value[0:2], 16),
        int(value[2:4], 16),
        int(value[4:6], 16),
    )


def mix_colors(left: str, right: str, weight: float) -> str:
    left_rgb = hex_to_rgb(left)
    right_rgb = hex_to_rgb(right)
    mixed = [round(a + (b - a) * weight) for a, b in zip(left_rgb, right_rgb)]
    return "#" + "".join(f"{channel:02x}" for channel in mixed)


def load_top25_codes() -> list[str]:
    iso_codes = pd.read_csv(DATA_DIR / "iso" / "countries.csv", index_col="alpha-3")
    gdp = pd.read_csv(
        TOP25_SOURCE,
        skiprows=WORLD_BANK_HEADER_SIZE,
        index_col="Country Code",
    )
    if "2025" in gdp.columns:
        gdp = gdp.drop(columns=["2025"])
    return gdp[gdp.index.isin(iso_codes.index)].nlargest(25, "2024").index.tolist()


def load_world_bank_availability(filename: str, spec: FigureSpec) -> AvailabilityDataset:
    frame = pd.read_csv(
        DATA_DIR / "worldbank" / filename,
        skiprows=WORLD_BANK_HEADER_SIZE,
        index_col="Country Code",
    )
    if "2025" in frame.columns:
        frame = frame.drop(columns=["2025"])
    top25_codes = load_top25_codes()
    year_columns = sorted((column for column in frame.columns if column.isdigit()), key=int)
    availability = frame.reindex(top25_codes)[year_columns].notna()
    return AvailabilityDataset(
        spec=spec,
        countries=top25_codes,
        years=[int(year) for year in year_columns],
        availability=availability,
    )


def load_etf_availability(spec: FigureSpec) -> AvailabilityDataset:
    top25_codes = load_top25_codes()
    yearly_observations: dict[str, set[int]] = {}

    for country_code, symbol in ETF_PROXY_SYMBOLS.items():
        csv_path = ETF_DIR / f"{symbol}.csv"
        if not csv_path.exists():
            continue
        frame = pd.read_csv(csv_path, parse_dates=["Date"])
        yearly_observations[country_code] = set(frame["Date"].dt.year.dropna().astype(int))

    covered_years = sorted({year for years in yearly_observations.values() for year in years})
    year_columns = [str(year) for year in covered_years]
    availability = pd.DataFrame(False, index=top25_codes, columns=year_columns, dtype=bool)

    for country_code in top25_codes:
        for year in yearly_observations.get(country_code, set()):
            availability.loc[country_code, str(year)] = True

    return AvailabilityDataset(
        spec=spec,
        countries=top25_codes,
        years=covered_years,
        availability=availability,
    )


def build_svg(spec: FigureSpec, countries: list[str], years: list[int], availability: pd.DataFrame) -> str:
    width = 1600
    height = 1120
    panel_x = 46
    panel_y = 38
    panel_width = width - panel_x * 2
    panel_height = height - panel_y * 2

    plot_x = 270
    plot_y = 208
    plot_width = 1168
    plot_height = 720
    cell_width = plot_width / len(years)
    cell_height = plot_height / len(countries)

    title_x = 90
    title_y = 112
    subtitle_y = 168
    legend_x = 1160
    legend_y = 118
    axis_y = plot_y + plot_height + 92

    tick_years = [year for year in years if year % 4 == 0]
    if years[-1] not in tick_years:
        tick_years.append(years[-1])

    all_present_year = None
    for year in years:
        if bool(availability[str(year)].all()):
            all_present_year = year
            break

    parts: list[str] = []
    append = parts.append

    append(
        f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" fill="none">'''
    )
    append("<defs>")
    append(
        f'''<linearGradient id="bgGradient" x1="0" y1="0" x2="0" y2="1">'''
        f'''<stop offset="0%" stop-color="{COLORS['bg1']}"/>'''
        f'''<stop offset="100%" stop-color="{COLORS['bg0']}"/>'''
        "</linearGradient>"
    )
    append(
        f'''<linearGradient id="panelGradient" x1="0" y1="0" x2="0" y2="1">'''
        f'''<stop offset="0%" stop-color="{COLORS['surface']}" stop-opacity="0.96"/>'''
        f'''<stop offset="100%" stop-color="{COLORS['surface_strong']}" stop-opacity="0.98"/>'''
        "</linearGradient>"
    )
    append(
        '''<radialGradient id="glowLeft" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(250 120) rotate(32) scale(640 340)">'''
        f'''<stop offset="0%" stop-color="{COLORS['accent']}" stop-opacity="0.23"/>'''
        f'''<stop offset="100%" stop-color="{COLORS['accent']}" stop-opacity="0"/>'''
        "</radialGradient>"
    )
    append(
        '''<radialGradient id="glowBottom" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1370 1010) rotate(180) scale(620 260)">'''
        f'''<stop offset="0%" stop-color="{COLORS['accent_alt']}" stop-opacity="0.12"/>'''
        f'''<stop offset="100%" stop-color="{COLORS['accent_alt']}" stop-opacity="0"/>'''
        "</radialGradient>"
    )
    append("</defs>")

    append(f'''<rect width="{width}" height="{height}" fill="url(#bgGradient)"/>''')
    append(f'''<rect width="{width}" height="{height}" fill="url(#glowLeft)"/>''')
    append(f'''<rect width="{width}" height="{height}" fill="url(#glowBottom)"/>''')
    append(
        f'''<rect x="{panel_x}" y="{panel_y}" width="{panel_width}" height="{panel_height}" rx="34" fill="url(#panelGradient)" stroke="{COLORS['hairline']}" stroke-opacity="0.08"/>'''
    )

    append(
        f'''<text x="{title_x}" y="{title_y}" fill="{COLORS['text']}" font-family="{FONT_STACK}" font-size="36" font-weight="800">{spec.title}</text>'''
    )
    append(
        f'''<text x="{title_x}" y="{subtitle_y}" fill="{COLORS['text_secondary']}" font-family="{FONT_STACK}" font-size="19">{spec.subtitle}</text>'''
    )

    append(
        f'''<rect x="{legend_x}" y="{legend_y}" width="16" height="16" rx="4" fill="{COLORS['accent']}" stroke="{COLORS['available_stroke']}" stroke-opacity="0.5"/>'''
    )
    append(
        f'''<text x="{legend_x + 26}" y="{legend_y + 13}" fill="{COLORS['text_secondary']}" font-family="{FONT_STACK}" font-size="16">Available</text>'''
    )
    append(
        f'''<rect x="{legend_x + 120}" y="{legend_y}" width="16" height="16" rx="4" fill="{COLORS['missing']}" stroke="{COLORS['missing_stroke']}"/>'''
    )
    append(
        f'''<text x="{legend_x + 146}" y="{legend_y + 13}" fill="{COLORS['text_secondary']}" font-family="{FONT_STACK}" font-size="16">Missing</text>'''
    )

    append(
        f'''<rect x="{plot_x}" y="{plot_y}" width="{plot_width}" height="{plot_height}" rx="18" fill="{COLORS['surface_strong']}" fill-opacity="0.54" stroke="{COLORS['hairline']}" stroke-opacity="0.06"/>'''
    )

    for row_index, country in enumerate(countries):
        row_y = plot_y + row_index * cell_height
        append(
            f'''<line x1="{plot_x}" y1="{row_y:.2f}" x2="{plot_x + plot_width}" y2="{row_y:.2f}" stroke="{COLORS['hairline']}" stroke-opacity="0.05"/>'''
        )
        append(
            f'''<text x="{plot_x - 22}" y="{row_y + cell_height / 2 + 5:.2f}" text-anchor="end" fill="{COLORS['text_secondary']}" font-family="{FONT_STACK}" font-size="18" font-weight="600">{country}</text>'''
        )

        for col_index, year in enumerate(years):
            value = bool(availability.loc[country, str(year)])
            rect_x = plot_x + col_index * cell_width
            rect_y = row_y
            if value:
                fill = mix_colors(COLORS["accent"], COLORS["accent_alt"], col_index / max(1, len(years) - 1))
                stroke = COLORS["available_stroke"]
                stroke_opacity = 0.18
            else:
                fill = COLORS["missing"]
                stroke = COLORS["missing_stroke"]
                stroke_opacity = 0.32
            append(
                f'''<rect x="{rect_x:.2f}" y="{rect_y:.2f}" width="{cell_width + 0.4:.2f}" height="{cell_height + 0.4:.2f}" fill="{fill}" stroke="{stroke}" stroke-opacity="{stroke_opacity}"/>'''
            )

    append(
        f'''<line x1="{plot_x}" y1="{plot_y + plot_height:.2f}" x2="{plot_x + plot_width}" y2="{plot_y + plot_height:.2f}" stroke="{COLORS['hairline']}" stroke-opacity="0.12"/>'''
    )
    append(
        f'''<line x1="{plot_x + plot_width:.2f}" y1="{plot_y}" x2="{plot_x + plot_width:.2f}" y2="{plot_y + plot_height}" stroke="{COLORS['hairline']}" stroke-opacity="0.08"/>'''
    )

    if all_present_year is not None:
        highlight_x = plot_x + years.index(all_present_year) * cell_width
        append(
            f'''<line x1="{highlight_x:.2f}" y1="{plot_y - 18}" x2="{highlight_x:.2f}" y2="{plot_y + plot_height + 8}" stroke="{COLORS['accent_alt']}" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="7 8"/>'''
        )
        append(
            f'''<rect x="{highlight_x - 6:.2f}" y="{plot_y - 24}" width="154" height="28" rx="14" fill="{COLORS['accent_soft']}" stroke="{COLORS['accent_alt']}" stroke-opacity="0.28"/>'''
        )
        append(
            f'''<text x="{highlight_x + 8:.2f}" y="{plot_y - 5}" fill="{COLORS['text']}" font-family="{FONT_STACK}" font-size="14" font-weight="700">All 25 present from {all_present_year}</text>'''
        )

    for year in tick_years:
        tick_x = plot_x + (years.index(year) + 0.5) * cell_width
        append(
            f'''<text x="{tick_x:.2f}" y="{axis_y}" transform="rotate(90 {tick_x:.2f} {axis_y})" text-anchor="start" fill="{COLORS['text_tertiary']}" font-family="{FONT_STACK}" font-size="15" font-weight="600">{year}</text>'''
        )

    append(
        f'''<text x="{plot_x + plot_width / 2:.2f}" y="{plot_y + plot_height + 146}" text-anchor="middle" fill="{COLORS['text_secondary']}" font-family="{FONT_STACK}" font-size="20" font-weight="700">Year</text>'''
    )
    append(
        f'''<text x="{100}" y="{plot_y + plot_height / 2:.2f}" transform="rotate(-90 100 {plot_y + plot_height / 2:.2f})" text-anchor="middle" fill="{COLORS['text_secondary']}" font-family="{FONT_STACK}" font-size="20" font-weight="700">Country (ISO-3)</text>'''
    )
    append("</svg>")
    return "".join(parts)


def export_png(svg_path: Path, png_path: Path) -> None:
    subprocess.run(
        ["sips", "-s", "format", "png", str(svg_path), "--out", str(png_path)],
        check=True,
        capture_output=True,
        text=True,
    )


def write_dataset(dataset: AvailabilityDataset) -> None:
    svg_path = Path(__file__).with_name(f"{dataset.spec.stem}.svg")
    png_path = Path(__file__).with_name(f"{dataset.spec.stem}.png")
    svg = build_svg(dataset.spec, dataset.countries, dataset.years, dataset.availability)
    svg_path.write_text(svg, encoding="utf-8")
    export_png(svg_path, png_path)
    print(f"Wrote {svg_path}")
    print(f"Wrote {png_path}")


def main() -> None:
    datasets = [
        load_world_bank_availability("market-cap-current-usd-2026.csv", FIGURES[0]),
        load_world_bank_availability("gdp-current-usd-2026.csv", FIGURES[1]),
        load_etf_availability(FIGURES[2]),
    ]
    for dataset in datasets:
        write_dataset(dataset)


if __name__ == "__main__":
    main()