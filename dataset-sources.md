
# Data overview

Data snapshot (`tree ./data`)

```
data
├── iso
│   └── countries.csv
├── nasdaq
│   ├── etf
│   │   ├── EWA.csv
│   │   ├── EWC.csv
│   │   ├── EWCO.csv
│   │   ├── EWD.csv
│   │   ├── EWG.csv
│   │   ├── EWGS.csv
│   │   ├── EWH.csv
│   │   ├── EWI.csv
│   │   ├── EWJ.csv
│   │   ├── EWJE.csv
│   │   ├── EWJV.csv
│   │   ├── EWK.csv
│   │   ├── EWL.csv
│   │   ├── EWM.csv
│   │   ├── EWMC.csv
│   │   ├── EWN.csv
│   │   ├── EWO.csv
│   │   ├── EWP.csv
│   │   ├── EWQ.csv
│   │   ├── EWRE.csv
│   │   ├── EWS.csv
│   │   ├── EWSC.csv
│   │   ├── EWT.csv
│   │   ├── EWU.csv
│   │   ├── EWUS.csv
│   │   ├── EWV.csv
│   │   ├── EWW.csv
│   │   ├── EWX.csv
│   │   ├── EWY.csv
│   │   ├── EWZ.csv
│   │   └── EWZS.csv
│   └── symbols-valid-meta.csv
└── worldbank
    ├── gdp-capita-current-usd-2026.csv
    ├── gdp-capita-ppp-international-usd-2021.csv
    ├── gdp-current-usd-2026.csv
    └── gdp-ppp-international-usd-2021.csv
```

# Data sources

## World Bank GDP Data

Main website: https://data.worldbank.org

GDP: https://data.worldbank.org/indicator/NY.GDP.MKTP.CD
GDP, PPP: https://data.worldbank.org/indicator/NY.GDP.MKTP.PP.KD
GDP per capita: https://data.worldbank.org/indicator/NY.GDP.PCAP.CD
GDP per capita, PPP: https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD

Current preprocessing uses the PPP-adjusted constant-dollar files for GDP and
GDP per capita:

- `data/worldbank/gdp-ppp-international-usd-2021.csv`
- `data/worldbank/gdp-capita-ppp-international-usd-2021.csv`

Current-USD GDP is still loaded as a conversion factor for asset-market proxies.

## ISO country data

Country codes, names, and region and continent classification

https://www.iso.org/iso-3166-country-codes.html

Actually acquired from:
https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes

## Stock Listing Data

Data sourced from:
https://www.kaggle.com/datasets/qks1lver/amex-nyse-nasdaq-stock-histories

Due to the large amount of not immediately relevant data, a few ETFs are chosen for now.

Stock symbol listing data:
- https://www.nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt
- https://www.nasdaqtrader.com/dynamic/symdir/otherlisted.txt

## Stock Indices Data

https://www.kaggle.com/datasets/guillemservera/global-stock-indices-historical-data

## Market Cap Data

World Bank market capitalisation of listed domestic companies (current USD):
https://data.worldbank.org/indicator/CM.MKT.LCAP.CD

File: `data/worldbank/market-cap-current-usd-2026.csv`

Exclusions: Russia, China, India, and Sweden, due to spotty data.

**ETF-proxy gap filling:**  
For several countries the World Bank series has gaps in recent years.
Gaps are filled using the country's iShares MSCI ETF price as a proxy:

> MC(year) ≈ MC(last_known_year) × (ETF_price(year) / ETF_price(last_known_year))

Market cap is converted from current USD to a constant-2021 PPP-equivalent
valuation proxy:

`MC_real_ppp = MC_current_usd * GDP_PPP_constant_2021 / GDP_current_USD`

## ETF Price Data (iShares MSCI country ETFs)

iShares MSCI country ETF daily price history. Files: `data/nasdaq/etf/EW*.csv`

Data after 2020 was supplemented using yfinance.

Countries for which reliable data from 2000 was not easily available are
excluded for now.

ETF prices are source adjusted-close prices, not inflation-adjusted prices. The
preprocessing converts them to a constant-2021 PPP-equivalent valuation proxy:

`ETF_real_ppp = ETF_nominal_usd * GDP_PPP_constant_2021 / GDP_current_USD`

This is an approximation: ETF prices are asset valuations, not GDP. The purpose
is to keep normalized trend comparisons on one broad real/PPP basis.

## Regional equity benchmarks

These are not yet shown in the UI, but the preprocessing setup now tracks them
as documented regional market proxies for later comparison views.

### Europe

- Fund: iShares Europe ETF (`IEV`)
- Official source: https://www.ishares.com/us/products/239736/ishares-europe-etf
- Local history file: `data/stock/history/IEV.csv`
- Coverage in repo: 2000 to 2020
- Use: broad Europe market benchmark, suitable for pre/post-2008 split work

### Asia-Pacific

- Fund: iShares MSCI Pacific ex Japan ETF (`EPP`)
- Official source: https://www.ishares.com/us/products/239674/ishares-msci-pacific-ex-japan-etf
- Local history file: `data/stock/history/EPP.csv`
- Coverage in repo: 2001 to 2020
- Caveat: excludes Japan, so it is only an approximate Asia-Pacific benchmark

Alternative local file:

- Fund: iShares Core MSCI Pacific ETF (`IPAC`)
- Official source: https://www.ishares.com/us/products/264619/
- Local history file: `data/stock/history/IPAC.csv`
- Coverage in repo: 2014 to 2020
- Caveat: too late for the full 2000-to-2008 story

### Latin America

- Fund: iShares Latin America 40 ETF (`ILF`)
- Official source: https://www.ishares.com/us/products/239761/ishares-latin-america-40-etf
- Local history file: `data/stock/history/ILF.csv`
- Coverage in repo: 2001 to 2020

### North America

- Official benchmark found: iShares MSCI North America UCITS ETF (`INAA`)
- Official fact sheet: https://www.ishares.com/uk/individual/en/literature/fact-sheet/inaa-ishares-msci-north-america-ucits-etf-fund-fact-sheet-en-gb.pdf
- Current repo status: no matching local history snapshot yet
- Implication: North America can be aggregated from country series today, but not
  yet benchmarked against a dedicated regional ETF inside the repo

## Regional macro aggregates

World Bank regional aggregates exist for major regions, including:

- Europe & Central Asia
- North America
- East Asia & Pacific

Official explorer examples:

- https://data.worldbank.org/?locations=Z4-Z7-ZJ-ZQ
- https://data.worldbank.org/?locations=XU-ZJ-Z7-Z4

These are useful later for region selector views, but they should be treated as
separate benchmark series, not mixed blindly with country averages, because the
World Bank regional definitions are broader than the current country subset used
in the narrative.

## ECB household balance-sheet add-on

This is a separate narrative module, not part of the core country/region
preprocessing pipeline. It exists to test the "growth for whom?" question
without coupling the main map/spider workflow to ECB-specific data.

Current local file:

- `public/ecb_household_assets.json`

Refresh command:

```bash
python scripts/fetch_ecb_household_assets.py
```

Current series:

- Euro area household financial assets
  - ECB Data Portal page:
    https://data.ecb.europa.eu/data/datasets/QSA/QSA.Q.N.I9.W0.S1M.S1.N.A.LE.F._Z._Z.XDC._T.S.V.N._T
  - API:
    https://data-api.ecb.europa.eu/service/data/QSA/Q.N.I9.W0.S1M.S1.N.A.LE.F._Z._Z.XDC._T.S.V.N._T?format=csvdata
- Euro area household net worth relative to gross disposable income
  - ECB Data Portal page:
    https://data.ecb.europa.eu/data/datasets/QSA/QSA.Q.N.I9.W0.S1M.S1._Z.B.B90._Z._Z._Z.XDC_R_B6G_CY._T.S.V.N._T
  - API:
    https://data-api.ecb.europa.eu/service/data/QSA/Q.N.I9.W0.S1M.S1._Z.B.B90._Z._Z._Z.XDC_R_B6G_CY._T.S.V.N._T?format=csvdata

Display rule in UI:

- both series are rebased to `2008-Q4 = 1`
- panel remains separate from the core post-2008 market/fundamentals analysis
  so it can be removed cleanly later if the final story changes

## Inequality add-on

This is a second separate narrative module focused on the question:
`who captured the post-2008 rebound?`

Current local file:

- `public/inequality_addon.json`

Refresh command:

```bash
python scripts/fetch_inequality_addon.py
```

Series included:

- US wealth shares from Federal Reserve Distributional Financial Accounts
  - main page: https://www.federalreserve.gov/releases/z1/dataviz/dfa/
  - ZIP download used in preprocessing:
    https://www.federalreserve.gov/releases/z1/dataviz/download/zips/dfa.zip
- Euro-area wealth shares from ECB Distributional Wealth Accounts
  - dataset guide: https://data.ecb.europa.eu/data/datasets/DWA/data-information
  - top 10% share:
    https://data-api.ecb.europa.eu/service/data/DWA/Q.I9.S14._Z._Z.NWA.T10.PT.S.N?format=csvdata
  - bottom 50% share:
    https://data-api.ecb.europa.eu/service/data/DWA/Q.I9.S14._Z._Z.NWA.B50.PT.S.N?format=csvdata
- Labour share from ILO modelled estimates
  - bulk table index:
    https://rplumber.ilo.org/files/website/bulk/indicator.html
  - direct CSV used:
    https://rplumber.ilo.org/data/indicator?id=LAP_2GDP_NOC_RT_A&format=.csv
  - geography used in UI:
    - `USA` = United States
    - `X92` = European Union 27
- Capital gains vs disposable income comparison
  - source paper:
    https://www.ecb.europa.eu/press/key/date/2025/html/ecb.sp251009~49b985af53.en.pdf
  - currently stored as cited headline values in local JSON:
    - United States: `24.0%`
    - Euro area: `4.2%`

## Three-part 2008 story data

This module is generated by `scripts/build_analysis_lab_data.py` and stored in
`public/analysis_lab_data.json`. It keeps the main story reversible: all new
panels depend on this generated JSON, not on ad-hoc calculations inside the
renderer.

Refresh command:

```bash
python scripts/build_analysis_lab_data.py
```

Pre-2008 growth uses the existing processed project series:

- GDP
- GDP per capita
- ETF price proxy
- listed market capitalization

The pre-2008 panel also stores a `runup` view:

- 2000 baseline is `1`
- 2007 dot shows the pre-crisis run-up
- 2008 dot shows the immediate break-year endpoint
- this avoids hiding the 2007-to-2008 market-cap drop inside a single
  2000-to-2008 multiple

Industrial-structure data is fetched directly from the World Bank API for
`USA` and `EUU`, using the latest available observation up to 2008:

- Manufacturing value added, `% GDP`: `NV.IND.MANF.ZS`
- Industry value added, `% GDP`: `NV.IND.TOTL.ZS`
- Services value added, `% GDP`: `NV.SRV.TOTL.ZS`
- Gross capital formation, `% GDP`: `NE.GDI.TOTL.ZS`
- R&D expenditure, `% GDP`: `GB.XPD.RSDV.GD.ZS`

These industrial indicators are not additive:

- manufacturing is a subset of industry
- industry and services are value-added shares
- investment and R&D are capacity/intensity measures, not output sectors

Current interpretation rule:

- the pre-2008 section is descriptive, not causal
- industrial structure is shown as context only
- any claim that sector composition caused the post-2008 divergence needs a
  separate sector-level analysis with output, market, employment, and export
  exposure data

Other generated story fields:

- `breakFinder`: piecewise-linear break-year fit for US/Europe gaps
- `counterfactual`: actual post-2008 path versus extrapolated 2000-2008 trend
- `scorecard`: post-2008 market, macro, labour-share, life-expectancy, and
  happiness comparison
- `heatmap`, `timeline`, `archetypes`, and `gainMatrix`: backup views parked in
  the UI under "Backup analysis"

Section-3 scorecard units:

- GDP per capita uses World Bank `NY.GDP.PCAP.PP.KD`: PPP-adjusted GDP per
  person in constant 2021 international dollars
- market rebound uses the PPP-equivalent ETF price proxy generated by preprocessing
- capital gains / income is a household financial-asset valuation measure
- labour share is percentage-point change in labour share of GDP
- life expectancy is change in years
- happiness is change in Cantril ladder score

Break-year methodology:

- gap series is `log(US / Europe)` for each metric
- candidate break years are 2005 through 2015
- model is `gap = intercept + time + post_break_time`
- each candidate model is scored with BIC
- displayed score is inverted and min-max normalized across candidate years:
  `1` = lowest BIC / best candidate, `0` = highest BIC / worst candidate
- this score is a relative fit ranking, not a probability or confidence interval

Counterfactual methodology:

- current counterfactual panel uses GDP per capita, not total GDP
- model fits `log(GDP per capita)` from 2000 through 2008
- post-2008 line compares actual normalized GDP per capita against that projected
  log-linear pre-break trend

Normalization explorer adjustment:

- all lines use the same preprocessed `public/spider_data.json` output
- GDP/cap lines use World Bank `NY.GDP.PCAP.PP.KD`
- ETF and market-cap lines use the PPP-equivalent valuation proxies generated in
  preprocessing
- for regions, GDP and market cap are summed across countries in the current
  project sample; GDP/cap and ETF proxy are averaged across countries
