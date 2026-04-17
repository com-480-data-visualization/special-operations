import "./style.css";
import * as d3 from "d3";
import { createSpiderChart, type SpiderData } from "./spider.ts";

async function main() {
  const data = (await d3.json("/spider_data.json")) as SpiderData;

  const select = document.getElementById("country-select") as HTMLSelectElement;
  const slider = document.getElementById("year-slider") as HTMLInputElement;
  const yearLabel = document.getElementById("year-label") as HTMLSpanElement;
  const legend = document.getElementById("legend") as HTMLDivElement;
  const chartContainer = document.getElementById("spider-chart") as HTMLDivElement;

  // Populate country dropdown (sorted by name)
  const sorted = Object.entries(data.countries).sort(([, a], [, b]) =>
    a.name.localeCompare(b.name)
  );
  for (const [iso3, country] of sorted) {
    const opt = document.createElement("option");
    opt.value = iso3;
    // Shorten long names
    const shortName = country.name
      .replace("United Kingdom of Great Britain and Northern Ireland", "United Kingdom")
      .replace("Korea, Republic of", "South Korea")
      .replace("Netherlands, Kingdom of the", "Netherlands");
    opt.textContent = `${shortName} (${country.etf})`;
    select.appendChild(opt);
  }

  // Configure slider
  slider.min = String(data.baselineYear);
  slider.max = String(data.latestYear);
  slider.value = String(data.latestYear);
  yearLabel.textContent = String(data.latestYear);

  // Create chart
  const updateChart = createSpiderChart(chartContainer, data);

  function getYearIndex(year: number) {
    return year - data.baselineYear;
  }

  function renderLegend(iso3: string, year: number) {
    const country = data.countries[iso3];
    if (!country) return;
    const yearIdx = getYearIndex(year);
    const mcExcluded = data.mcExcluded?.includes(iso3);

    const shortName = country.name
      .replace("United Kingdom of Great Britain and Northern Ireland", "United Kingdom")
      .replace("Korea, Republic of", "South Korea")
      .replace("Netherlands, Kingdom of the", "Netherlands")
      .replace("United States of America", "United States");

    legend.innerHTML =
      `<h3>${shortName} &mdash; ${year}</h3>` +
      `<p class="etf-label">ETF: ${country.etf}</p>` +
      `<ul>` +
      data.axes
        .map((axis) => {
          const ts = country.timeseries[axis];
          const val = ts && yearIdx < ts.length ? ts[yearIdx] : null;
          let display: string;
          let cls = "axis-val";
          if (axis === "Market Cap" && mcExcluded) {
            display = "excluded";
            cls = "axis-val axis-excluded";
          } else if (val !== null && val !== undefined) {
            display = `${val.toFixed(2)}×`;
          } else {
            display = "n/a";
            cls = "axis-val axis-na";
          }
          return `<li><span class="axis-name">${axis}</span><span class="${cls}">${display}</span></li>`;
        })
        .join("") +
      `</ul>` +
      (mcExcluded
        ? `<p class="mc-note">Market Cap excluded: unreliable data</p>`
        : "");
  }

  function update() {
    const iso3 = select.value;
    const year = parseInt(slider.value, 10);
    yearLabel.textContent = String(year);
    if (!iso3) return;
    updateChart(iso3, getYearIndex(year));
    renderLegend(iso3, year);
  }

  select.addEventListener("change", update);
  slider.addEventListener("input", update);

  // Initial render – default to Germany as an illustrative example
  const defaultCountry = sorted.find(([iso3]) => iso3 === "DEU")?.[0] ?? sorted[0]?.[0];
  if (defaultCountry) {
    select.value = defaultCountry;
    update();
  }
}

main().catch(console.error);
