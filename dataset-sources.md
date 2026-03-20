
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

# Stock Indices Data

https://www.kaggle.com/datasets/guillemservera/global-stock-indices-historical-data
