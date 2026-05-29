# 2008 Decoupling Report

## Question

Hypothesis: `2008` caused major regions to decouple in economic growth.

Regions tested:

- `USA`: United States
- `NAC`: North America
- `EUU`: European Union
- `EAS`: East Asia & Pacific
- `SAS`: South Asia
- `LCN`: Latin America & Caribbean

Main follow-up question: if US rebounded more than Europe after crisis, where did gains go? Did people benefit?

## Theory

Decoupling has multiple meanings. Need separate tests:

1. **Growth synchronization**
   - Test whether region growth rates move together less after candidate break.
   - Metric: avg pairwise corr of annual log real GDP/cap growth.
   - Problem: shared shocks raise corr. 2008, COVID, energy shocks can make regions more correlated even while levels diverge.

2. **Growth dispersion**
   - Test whether annual growth rates spread out after candidate break.
   - Metric: avg cross-region std dev of annual log real GDP/cap growth.

3. **Relative trajectory break**
   - Test whether normalized levels change trend after candidate break.
   - Metric: piecewise linear regression on log real GDP/cap levels.
   - For US vs EU: fit break on `log(US GDP/cap) - log(EU GDP/cap)`.

4. **Market decoupling**
   - Test whether public-market proxies diverge more than macro fundamentals.
   - Metric: US vs Europe ETF-price gap and market-cap gap.

5. **Distribution pass**
   - If US grows more, ask who captured gains:
     - capital gains vs disposable income
     - top 10 / bottom 50 wealth shares
     - labour share of GDP
     - household consumption per cap
     - life expectancy and reported life satisfaction

Best interpretation:

- `2008` should be treated as crisis shock and likely market-regime break.
- Real-economy decoupling may lag into `2010-2013`, due eurozone crisis, austerity, banking fragmentation, China/Asia reacceleration, US tech/asset rebound.

## Data

World Bank API:

- real GDP per capita: `NY.GDP.PCAP.KD`
- real GDP: `NY.GDP.MKTP.KD`
- household final consumption per capita: `NE.CON.PRVT.PC.KD`
- life expectancy: `SP.DYN.LE00.IN`

Existing local project data:

- GDP/GDP-cap from `public/spider_data.json`, now rebuilt on World Bank
  constant-2021 PPP international-dollar series
- ETF-price and market-cap proxies from `public/spider_data.json`, now converted
  to constant-2021 PPP-equivalent valuation proxies with
  `GDP_PPP_constant_2021 / GDP_current_USD`

Distribution sources:

- Federal Reserve DFA ZIP:
  `https://www.federalreserve.gov/releases/z1/dataviz/download/zips/dfa.zip`
- ECB DWA top 10 / bottom 50 wealth shares:
  `https://data-api.ecb.europa.eu/service/data/DWA/Q.I9.S14._Z._Z.NWA.T10.PT.S.N?format=csvdata`
  `https://data-api.ecb.europa.eu/service/data/DWA/Q.I9.S14._Z._Z.NWA.B50.PT.S.N?format=csvdata`
- ILO labour share:
  `https://rplumber.ilo.org/data/indicator?id=LAP_2GDP_NOC_RT_A&format=.csv`
- ECB asset gains comparison:
  `https://www.ecb.europa.eu/press/key/date/2025/html/ecb.sp251009~49b985af53.en.pdf`
- happiness proxy:
  `https://ourworldindata.org/grapher/happiness-cantril-ladder.csv`

## Current Local Rebuild: Constant-PPP Basis

After rebuilding the project data consistently, the story changes:

- GDP/cap decoupling is present but moderate.
- Market-proxy decoupling remains much sharper.
- `2008` is strongest for ETF and market-cap break timing.
- GDP/cap gap best-fit year shifts to `2011`, so GDP/cap should not be framed as
  an exact 2008 break.

Project sample, `2008-2023` multiples:

| Metric | US | Europe | Asia-Pacific |
|---|---:|---:|---:|
| GDP per capita, PPP | `1.22x` | `1.09x` | `1.31x` |
| ETF proxy, PPP-equivalent | `1.84x` | `0.69x` | `0.67x` |
| Market cap, PPP-equivalent | `3.09x` | `1.76x` | `2.55x` |

Project sample, `2000-2008` multiples:

| Metric | US | Europe |
|---|---:|---:|
| GDP per capita, PPP | `1.10x` | `1.12x` |
| GDP, PPP | `1.19x` | `1.17x` |
| ETF proxy, PPP-equivalent | `0.82x` | `0.92x` |
| Market cap, PPP-equivalent | `0.63x` | `0.62x` |

Updated narrative:

- Before 2008, US and Europe look broadly similar on real/PPP growth in this
  sample.
- After 2008, US real GDP/cap outperforms Europe, but Asia-Pacific outperforms
  both.
- The cleanest US-Europe split is not output; it is market valuation and
  household capital-gain capture.

## Test 1: Global GDP/cap Growth Synchronization

Annual log real GDP/cap growth, regions `USA, NAC, EUU, EAS, SAS, LCN`.

Candidate breaks tested: `2005-2015`.

Result for `2008`:

- avg pairwise growth corr: `0.63 -> 0.78`
- growth dispersion: `1.75 pp -> 2.08 pp`

Interpretation:

- Corr test does **not** support simple "regions became less synchronized after 2008".
- Corr rises after 2008, likely because global shocks dominate annual growth moves.
- Dispersion rises modestly, so regions do spread more in growth outcomes.
- Conclusion: simple correlation is wrong test if question is long-run divergence.

Best score under corr/disp decoupling:

- weak, unstable
- no clean 2008 winner
- post-2008 corr generally higher, so corr-based decoupling fails

## Test 2: Global Piecewise Trend Break

Model: normalized log real GDP/cap level per region.

Fit: `level = a + b * year + c * max(0, year - break)`.

Best BIC:

- best break: `2013`
- nearby: `2012`, `2014`
- `2008` improves fit vs earlier years but is not best

Interpretation:

- Global real-economy divergence looks more like `2008 shock + 2010-2013 regime separation`.
- This matches known sequence: financial crisis, eurozone crisis, US recovery, Asia/South Asia continued catch-up.

## Regional Growth Results

Real GDP/cap CAGR:

| Region | 2000-2008 | 2008-2024 | 2008-2024 multiple |
|---|---:|---:|---:|
| USA | `1.25%` | `1.36%` | `1.24x` |
| North America | `1.26%` | `1.26%` | `1.22x` |
| EU | `1.69%` | `0.92%` | `1.16x` |
| East Asia & Pacific | `4.54%` | `3.87%` | `1.84x` |
| South Asia | `4.54%` | `4.99%` | `2.18x` |
| Latin America & Caribbean | `2.07%` | `0.69%` | `1.12x` |

Real GDP CAGR, `2008-2024`:

| Region | CAGR | Multiple |
|---|---:|---:|
| USA | `2.07%` | `1.39x` |
| North America | `2.04%` | `1.38x` |
| EU | `1.06%` | `1.18x` |
| East Asia & Pacific | `4.46%` | `2.01x` |
| South Asia | `6.15%` | `2.60x` |
| Latin America & Caribbean | `1.59%` | `1.29x` |

Read:

- US outperforms EU after 2008, but not explosively in real GDP/cap.
- Asia/South Asia growth story is much stronger than US/EU split.
- Latin America stagnates most.
- If webpage story focuses only US vs EU, be clear this is not "US beats world"; it is "US beats Europe, Asia beats both in real growth".

## US vs EU: Break Timing

World Bank real GDP/cap gap:

Model on `log(USA GDP/cap) - log(EU GDP/cap)`.

Best break years:

| Break | Pre slope | Post slope | Slope change |
|---|---:|---:|---:|
| `2010` | `-0.20 pp/yr` | `+0.36 pp/yr` | `+0.56 pp/yr` |
| `2011` | `-0.16 pp/yr` | `+0.39 pp/yr` | `+0.54 pp/yr` |
| `2009` | `-0.25 pp/yr` | `+0.33 pp/yr` | `+0.58 pp/yr` |
| `2008` | `-0.29 pp/yr` | `+0.31 pp/yr` | `+0.60 pp/yr` |

Read:

- Exact best real-GDP/cap break is `2010`, not `2008`.
- `2008` remains close and substantively meaningful.
- Better claim: `2008 crisis starts decoupling; US/EU real-economy divergence becomes visible around 2009-2011`.

## US vs Europe: Market Break

Using local project ETF and market-cap proxies.

US/Europe gap, piecewise break:

| Metric | Best break | Interpretation |
|---|---:|---|
| ETF price gap | `2008` | strongest market-regime break |
| Market-cap gap | `2007` / `2008` | market-cap divergence starts around crisis |
| GDP/cap gap in rebuilt project data | `2011` | GDP/cap divergence is later and weaker than market divergence |

Post-2008 market/fundamental contrast:

| Metric | US post-2008 CAGR | Europe post-2008 CAGR | US multiple | Europe multiple |
|---|---:|---:|---:|---:|
| ETF proxy, PPP-equivalent | `4.16%` | `-2.49%` | `1.84x` | `0.69x` |
| Market cap, PPP-equivalent | `7.81%` | `3.85%` | `3.09x` | `1.76x` |

Read:

- Market decoupling supports `2008` strongly.
- Fundamentals decouple later and less dramatically.
- Main visual should separate `real economy` from `asset markets`.

## Where Did US Gains Go?

### Capital gains vs disposable income

ECB comparison:

| Region | Avg annual capital gains on household financial assets / disposable income |
|---|---:|
| United States | `24.0%` |
| Euro area | `4.2%` |

Interpretation:

- US rebound converted much more strongly into household financial asset gains.
- This does not mean all households benefited equally. Asset ownership is concentrated.

### Wealth concentration

US, Fed DFA:

| Group | 2008-Q4 | 2025-Q4 | Change |
|---|---:|---:|---:|
| Top 10 wealth share | `66.5%` | `68.3%` | `+1.8 pp` |
| Bottom 50 wealth share | `1.0%` | `2.5%` | `+1.5 pp` |

Euro area, ECB DWA:

| Group | 2009-Q1 | 2025-Q3 | Change |
|---|---:|---:|---:|
| Top 10 wealth share | `54.16%` | `57.15%` | `+2.99 pp` |
| Bottom 50 wealth share | `4.93%` | `5.09%` | `+0.16 pp` |

Read:

- Symmetry: top wealth share rises in both regions.
- Asymmetry: US starts from much higher concentration.
- Bottom half remains tiny in both, especially US.
- US bottom-half share improves from very low base, but top 10 still holds about two-thirds of wealth.

### Labour share

ILO labour income share:

| Region | 2008 | 2025 | Change |
|---|---:|---:|---:|
| US | `60.854%` | `55.807%` | `-5.05 pp` |
| EU-27 | `58.4%` | `57.6%` | `-0.8 pp` |

Interpretation:

- US growth after 2008 is more capital-skewed.
- EU labour share is flatter, but EU total growth weaker.
- US story: bigger rebound, more asset gains, labour gets smaller slice.
- EU story: weaker rebound, less asset-gain upside, labour share less damaged.

## Did People Benefit?

### Household consumption

World Bank household final consumption per capita:

| Region | 2008-latest CAGR | Multiple |
|---|---:|---:|
| US | `1.42%` to 2022 | `1.22x` |
| EU | `0.62%` to 2023 | `1.10x` |

Read:

- US average consumption improved more.
- This supports "some material benefit reached households".
- But distribution evidence says gains were uneven and capital-heavy.

### Life expectancy

World Bank life expectancy:

| Region | 2008 | 2024 | Change |
|---|---:|---:|---:|
| US | `78.04` | `78.89` | `+0.85 years` |
| EU | `79.13` | `81.56` | `+2.43 years` |

Read:

- EU outperforms US on health outcome improvement.
- US economic/market rebound did not translate into comparable health gains.

### Reported life satisfaction

OWID Cantril ladder:

| Region | 2012 | 2019 | 2024 |
|---|---:|---:|---:|
| US | `7.08` | `6.94` | `6.72` |
| EU-27 avg | `6.18` | `6.53` | `6.58` |

Read:

- US starts higher but declines.
- EU avg improves.
- This weakens any simple "US growth made people happier" claim.
- Happiness data starts later than 2008 for many countries, so use as supporting evidence only.

## Local Business Development

World Bank new business density:

- EU aggregate available:
  - `2006`: `2.92` new LLC registrations per 1,000 working-age people
  - `2022`: `3.79`
- US aggregate unavailable in same World Bank series.

Conclusion:

- Not enough symmetric data yet for US vs EU local business formation.
- Current market-cap / ETF data mostly measures listed capital markets, not local business dynamism.
- Need next data pass:
  - US Census Business Dynamics Statistics
  - Eurostat business demography
  - OECD entrepreneurship indicators
  - venture-capital / startup investment if story shifts to innovation ecosystem

## Main Findings

1. `2008` is not clean global GDP-growth correlation break.
   - Growth corr rises after 2008 due common shocks.
   - Correlation alone is bad measure of decoupling.

2. Real-economy decoupling is staggered.
   - Global trend break best around `2012-2013`.
   - US/EU real GDP/cap gap best around `2010`.
   - `2008` is still plausible as causal shock, but not exact statistical optimum for all metrics.

3. Market decoupling fits `2008` strongly.
   - US/Europe ETF gap break best at `2008`.
   - Market-cap gap break around `2007-2008`.
   - Public-market story is sharper than macro story.

4. US rebound is more capital-heavy.
   - US household financial capital gains relative to disposable income far exceed euro area.
   - US labour share falls much more.
   - Wealth concentration remains much higher in US.

5. US households gained materially on average, but broad welfare story is mixed.
   - US consumption per cap grows more than EU.
   - US life expectancy improves less.
   - US reported life satisfaction falls, while EU avg rises.

6. EU story is not simple failure.
   - EU markets lag strongly.
   - EU real GDP/cap grows slower.
   - But labour share is more stable, life expectancy improves more, happiness improves.
   - Europe looks weaker in capital markets, not uniformly worse for people.

## Recommended Web Narrative

Best title:

`2008: Shock, then split`

Suggested section structure:

1. **Did 2008 break global growth?**
   - Show break-score chart across candidate years.
   - Message: exact break differs by metric; `2008` strongest for markets, `2010-2013` for real growth.

2. **US vs Europe: markets split faster than fundamentals**
   - Indexed `2008 = 1` chart:
     - real GDP/cap
     - household consumption/cap
     - ETF/market proxy
   - Message: US outperformance exists in real economy, but market gap is much larger.

3. **Where did gains go?**
   - Matrix:
     - capital gains / disposable income
     - top 10 wealth share change
     - bottom 50 wealth share change
     - labour share change
   - Message: US gains went more through capital markets; labour share fell harder.

4. **Did people feel richer?**
   - Small table / slope chart:
     - consumption/cap
     - life expectancy
     - life satisfaction
   - Message: US material consumption rises more; EU improves more on health/happiness.

## Next Data Work

High value:

- build reproducible analysis script from this report
- add World Bank real GDP/cap + consumption/cap regional JSON
- add break-score JSON for candidate years
- add local business data from US Census + Eurostat/OECD
- verify ETF proxies against broader MSCI regional index data

Avoid:

- forcing all indicators into one spider plot
- using flat wealth-share time series as main visual
- treating `2008` as proven exact break for all data

## Bottom Line

Hypothesis should be refined:

> 2008 was the market-regime break and initiating shock. Real-economy divergence emerged over the following years, especially `2009-2013`. US outperformed Europe after the crisis, but the most dramatic split was in asset markets. US gains flowed more to financial capital and top wealth groups, while labour share fell harder. Average US consumption rose more, yet health and happiness outcomes do not show a clean broad-population win over Europe.
