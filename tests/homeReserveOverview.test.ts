import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHomeReserveOverviewRows,
  buildHomeReserveOverviewSeedRows,
} from "../src/shared/homeReserveOverview";

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
