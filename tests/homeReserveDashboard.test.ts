import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("../src/components/HomeReserveAnalysisDashboard.tsx", import.meta.url);

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
});
