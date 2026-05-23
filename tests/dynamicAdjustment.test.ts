import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDynamicAdjustmentDiffs,
  createEmptyDynamicAdjustmentForm,
  normalizeDynamicAdjustmentPayload,
} from "../src/shared/dynamicAdjustment";

test("calculateDynamicAdjustmentDiffs subtracts before values from after values", () => {
  const result = calculateDynamicAdjustmentDiffs({
    beforeDailyLiquid: 7.2,
    beforeDailyOil: 3.6,
    beforeWaterCut: 35,
    afterDailyLiquid: 8.1,
    afterDailyOil: 4,
    afterWaterCut: 32,
  });

  assert.deepEqual(result, {
    diffDailyLiquid: 0.9,
    diffDailyOil: 0.4,
    diffWaterCut: -3,
  });
});

test("calculateDynamicAdjustmentDiffs returns null when either side is missing", () => {
  const result = calculateDynamicAdjustmentDiffs({
    beforeDailyLiquid: 7.2,
    beforeDailyOil: null,
    beforeWaterCut: 35,
    afterDailyLiquid: 8.1,
    afterDailyOil: 4,
    afterWaterCut: undefined,
  });

  assert.deepEqual(result, {
    diffDailyLiquid: 0.9,
    diffDailyOil: null,
    diffWaterCut: null,
  });
});

test("normalizeDynamicAdjustmentPayload trims text and converts numeric strings", () => {
  const result = normalizeDynamicAdjustmentPayload({
    adjustmentWaterWell: " 高2-4-055 ",
    injectionProcess: " 分注 ",
    adjustmentDate: "2026-05-22",
    beforeDailyInjection: "12.5",
    afterDailyInjection: "14",
    adjustmentPurpose: " 解决污水平衡 ",
    trackedOilWell: " 高2-4-075 ",
    beforeDailyLiquid: "7.2",
    beforeDailyOil: "3.6",
    beforeWaterCut: "35",
    afterDailyLiquid: "8.1",
    afterDailyOil: "4",
    afterWaterCut: "32",
    stageDays: "30",
    cumulativeOil: "12",
    remark: " 现场复核 ",
  });

  assert.deepEqual(result, {
    adjustmentWaterWell: "高2-4-055",
    injectionProcess: "分注",
    adjustmentDate: "2026-05-22",
    beforeDailyInjection: 12.5,
    afterDailyInjection: 14,
    adjustmentPurpose: "解决污水平衡",
    trackedOilWell: "高2-4-075",
    beforeDailyLiquid: 7.2,
    beforeDailyOil: 3.6,
    beforeWaterCut: 35,
    afterDailyLiquid: 8.1,
    afterDailyOil: 4,
    afterWaterCut: 32,
    diffDailyLiquid: 0.9,
    diffDailyOil: 0.4,
    diffWaterCut: -3,
    stageDays: 30,
    cumulativeOil: 12,
    remark: "现场复核",
  });
});

test("createEmptyDynamicAdjustmentForm keeps screenshot default purposes available", () => {
  const form = createEmptyDynamicAdjustmentForm();

  assert.equal(form.adjustmentPurpose, "解决污水平衡");
  assert.equal(form.adjustmentWaterWell, "");
  assert.equal(form.trackedOilWell, "");
});
