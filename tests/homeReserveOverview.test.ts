import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHomeReserveDashboardData,
  buildHomeReserveOverviewRows,
  buildHomeReserveOverviewSeedRows,
  formatHomeReserveValue,
} from "../src/shared/homeReserveOverview";

test("home reserve values use the shared finite, compact number format", () => {
  assert.equal(formatHomeReserveValue(794.5), "794.5");
  assert.equal(formatHomeReserveValue(23.5, "%"), "23.5%");
  assert.equal(formatHomeReserveValue(1000), "1000");
  assert.equal(formatHomeReserveValue(Number.POSITIVE_INFINITY), "");
});

test("home reserve overview seed rows cover the requested home table blocks", () => {
  const rows = buildHomeReserveOverviewRows(buildHomeReserveOverviewSeedRows());

  assert.deepEqual(rows.map((row) => [row.unit, row.block, row.rowType]), [
    ["采一", "雷11", "block"],
    ["采一", "雷04", "block"],
    ["采一", "雷72", "block"],
    ["采一", "小计", "subtotal"],
    ["采二", "牛心坨油层", "block"],
    ["采二", "牛心坨潜山", "block"],
    ["采二", "坨33", "block"],
    ["采二", "小计", "subtotal"],
    ["合计", "", "total"],
  ]);
});

test("home reserve overview subtotals and total sum numeric mock values", () => {
  const rows = buildHomeReserveOverviewRows([
    { unit: "采一", block: "雷11", oilArea: 1, producingReserve: 20, recoverableReserve: 3, recoveryRate: 15, lastYearOil: 4, sortOrder: 1 },
    { unit: "采一", block: "雷04", oilArea: 5, producingReserve: 60, recoverableReserve: 12, recoveryRate: 20, lastYearOil: 8, sortOrder: 2 },
    { unit: "采二", block: "坨33", oilArea: 9, producingReserve: 100, recoverableReserve: 30, recoveryRate: 30, lastYearOil: 12, sortOrder: 3 },
  ]);

  assert.deepEqual(
    rows.filter((row) => row.rowType !== "block").map((row) => ({
      unit: row.unit,
      block: row.block,
      oilArea: row.oilArea,
      producingReserve: row.producingReserve,
      recoverableReserve: row.recoverableReserve,
      recoveryRate: row.recoveryRate,
      lastYearOil: row.lastYearOil,
    })),
    [
      { unit: "采一", block: "小计", oilArea: 6, producingReserve: 80, recoverableReserve: 15, recoveryRate: 18.75, lastYearOil: 12 },
      { unit: "采二", block: "小计", oilArea: 9, producingReserve: 100, recoverableReserve: 30, recoveryRate: 30, lastYearOil: 12 },
      { unit: "合计", block: "", oilArea: 15, producingReserve: 180, recoverableReserve: 45, recoveryRate: 25, lastYearOil: 24 },
    ],
  );
});

test("home reserve dashboard data derives blocks, ranking, totals, and unit contributions", () => {
  const dashboard = buildHomeReserveDashboardData(
    buildHomeReserveOverviewRows(buildHomeReserveOverviewSeedRows()),
  );

  assert.equal(dashboard.blocks.length, 6);
  assert.deepEqual(dashboard.ranking.map((row) => row.block), [
    "牛心坨油层",
    "雷11",
    "牛心坨潜山",
    "雷04",
    "雷72",
    "坨33",
  ]);
  assert.deepEqual(
    {
      producingReserve: dashboard.total.producingReserve,
      recoverableReserve: dashboard.total.recoverableReserve,
      recoveryRate: dashboard.total.recoveryRate,
      lastYearOil: dashboard.total.lastYearOil,
    },
    { producingReserve: 794.5, recoverableReserve: 184.6, recoveryRate: 23.23, lastYearOil: 25.55 },
  );
  assert.deepEqual(dashboard.units.map((row) => row.unit), ["采一", "采二"]);
  assert.equal(dashboard.ranking[0].contributionRate, 27.92);
  assert.deepEqual(dashboard.units.map((row) => row.contributionRate), [44.72, 55.28]);
});

test("home reserve dashboard data keeps empty input totals and contribution rates finite", () => {
  const dashboard = buildHomeReserveDashboardData([]);

  assert.equal(dashboard.total.producingReserve, 0);
  assert.equal(dashboard.total.recoveryRate, 0);
  assert.deepEqual(dashboard.ranking, []);
  assert.ok(dashboard.units.every((row) => Number.isFinite(row.contributionRate)));
});
