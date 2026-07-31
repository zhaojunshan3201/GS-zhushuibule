import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  formatChartTooltipValue,
  HomeReserveAnalysisDashboard,
} from "../src/components/HomeReserveAnalysisDashboard";
import {
  buildHomeReserveOverviewRows,
  buildHomeReserveOverviewSeedRows,
} from "../src/shared/homeReserveOverview";

const componentUrl = new URL("../src/components/HomeReserveAnalysisDashboard.tsx", import.meta.url);
const appUrl = new URL("../src/App.tsx", import.meta.url);

test("home page places the reserve dashboard above the unchanged overview table", async () => {
  const source = await readFile(appUrl, "utf8");
  const homePage = source.slice(source.indexOf("function HomePage()"), source.indexOf("function PlaceholderPage"));

  assert.match(source, /import \{ HomeReserveAnalysisDashboard \} from "\.\/components\/HomeReserveAnalysisDashboard";/);
  assert.ok(homePage.indexOf("<HomeReserveAnalysisDashboard rows={rows} />") < homePage.indexOf("储量概览列表"));
  assert.match(homePage, /<section[^>]*aria-labelledby="reserve-table-title"[^>]*>/);
  assert.match(homePage, /<h2 id="reserve-table-title"/);
  assert.match(homePage, /"\/api\/home-reserve-overview"/);
  for (const header of ["单位", "区块", "含油面积", "动用储量", "可采储量", "标定采收率", "上年度产油"]) {
    assert.match(homePage, new RegExp(`"${header}"`));
  }
});

test("home reserve analysis dashboard exposes the requested analytics content", async () => {
  const source = await readFile(componentUrl, "utf8");

  assert.match(source, /export function HomeReserveAnalysisDashboard/);
  assert.match(source, /储量分析看板/);
  assert.match(source, /buildHomeReserveDashboardData/);
  for (const metric of ["动用储量", "可采储量", "标定采收率", "上年度产油"]) {
    assert.match(source, new RegExp(metric));
  }
});

test("home reserve analysis dashboard includes accessible, consistently colored charts", async () => {
  const source = await readFile(componentUrl, "utf8");

  for (const chartPrimitive of ["ComposedChart", "BarChart", "Line"]) {
    assert.match(source, new RegExp(chartPrimitive));
  }
  for (const color of ["#0f766e", "#d99545", "#486581"]) {
    assert.match(source, new RegExp(color));
  }
  assert.match(source, /dashboard\.ranking\.map/);
  assert.match(source, /dashboard\.units\.map/);
  assert.match(source, /aria-label=/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /min-w-\[720px\]/);
  assert.doesNotMatch(source, /unit=" 万吨/);
});

test("home reserve analysis dashboard renders nothing without rows", () => {
  const markup = renderToStaticMarkup(createElement(HomeReserveAnalysisDashboard, { rows: [] }));

  assert.equal(markup, "");
});

test("home reserve analysis dashboard renders accurate totals and unit contributions", () => {
  const rows = buildHomeReserveOverviewRows(buildHomeReserveOverviewSeedRows());
  const markup = renderToStaticMarkup(createElement(HomeReserveAnalysisDashboard, { rows }));
  const renderedText = markup.replace(/<[^>]+>/g, "");

  for (const value of ["794.5", "184.6", "23.23%", "25.55", "采一", "44.72%", "采二", "55.28%"]) {
    assert.match(renderedText, new RegExp(value));
  }
});

test("home reserve chart tooltip values use one precise unit suffix", () => {
  assert.equal(formatChartTooltipValue(794.5, "reserve"), "794.5 万吨");
  assert.equal(formatChartTooltipValue(25.55, "oil"), "25.55 万吨/年");
  assert.equal(formatChartTooltipValue(44.72, "percent"), "44.72%");
});
