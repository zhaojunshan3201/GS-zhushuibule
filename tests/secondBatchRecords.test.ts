import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConcentricTestWhere,
  buildDynamicAnalysisWhere,
  buildSecondBatchSeedRows,
  buildSingleWellEvaluationWhere,
  createEmptyConcentricTestForm,
  createEmptySingleWellInjectionEvaluationForm,
  createEmptySingleWellSealEvaluationForm,
  createEmptySmartTestForm,
  filterDynamicAnalysisRowsByDiffThresholds,
  normalizeConcentricTestPayload,
  normalizeSingleWellInjectionEvaluationPayload,
  normalizeSingleWellSealEvaluationPayload,
  normalizeSmartTestPayload,
} from "../src/shared/secondBatchRecords";

test("buildSecondBatchSeedRows provides second-batch page data", () => {
  const seeds = buildSecondBatchSeedRows();

  assert.equal(seeds.concentricTests.length, 26);
  assert.equal(seeds.smartTests.length, 26);
  assert.equal(seeds.singleWellInjectionEvaluations.length, 38);
  assert.equal(seeds.singleWellSealEvaluations.length, 38);
  assert.equal(seeds.zonalIndicatorSummaries.length, 9);
  assert.equal(seeds.dynamicAnalysisRows.length, 75);
  assert.equal(seeds.concentricTests[0].layerFreedom.length, 4);
  assert.equal(seeds.smartTests[0].dailyAllocation.length, 5);
  assert.equal(seeds.zonalIndicatorSummaries[0].segmentSeal.length, 5);
});

test("second-batch where helpers keep filters server-side", () => {
  assert.deepEqual(buildConcentricTestWhere({ wellNo: "雷19", fromDate: "2026-05-01" }), {
    wellNo: { contains: "雷19", mode: "insensitive" },
    testDate: { gte: new Date("2026-05-01T00:00:00.000Z") },
  });

  assert.deepEqual(buildSingleWellEvaluationWhere({ unit: "采油作业一区", process: "智能分注", wellNo: "雷" }), {
    unit: "采油作业一区",
    process: "智能分注",
    wellNo: { contains: "雷", mode: "insensitive" },
  });

  assert.deepEqual(buildDynamicAnalysisWhere({ kind: "single-oil", unit: "采油作业一区", block: "区块1", wellNo: "GS-1" }), {
    kind: "single-oil",
    unit: "采油作业一区",
    block: "区块1",
    wellNo: { contains: "GS-1", mode: "insensitive" },
  });
});

test("createEmptyConcentricTestForm prepares four editable layer fields", () => {
  const form = createEmptyConcentricTestForm("2026-05-23");

  assert.equal(form.testDate, "2026-05-23");
  assert.equal(form.allocatorCount, "4");
  assert.deepEqual(form.layerFreedom, ["", "", "", ""]);
  assert.deepEqual(form.dailyInjection, ["", "", "", ""]);
});

test("normalizeConcentricTestPayload trims modal input for database storage", () => {
  const result = normalizeConcentricTestPayload({
    wellNo: " 雷19-10 ",
    testDate: " 2026-05-23 ",
    allocatorCount: "4",
    freedom: " 完全自由 ",
    partialStroke: "",
    fullyStuck: " ",
    layerFreedom: ["完全自由", "", "部分行程"],
    dailyInjection: ["30", "", "18.5"],
    remark: " 新增记录 ",
  });

  assert.deepEqual(result, {
    wellNo: "雷19-10",
    testDate: "2026-05-23",
    allocatorCount: 4,
    freedom: "完全自由",
    partialStroke: null,
    fullyStuck: null,
    layerFreedom: ["完全自由", "-", "部分行程", "-"],
    dailyInjection: ["30", "-", "18.5", "-"],
    remark: "新增记录",
  });
});

test("second-batch modal forms prepare editable array fields", () => {
  assert.equal(createEmptySmartTestForm("2026-05-23").dailyAllocation.length, 5);
  assert.equal(createEmptySmartTestForm("2026-05-23").innerPressure.length, 5);
  assert.equal(createEmptySingleWellInjectionEvaluationForm("2026-05-23").unqualified.length, 6);
  assert.equal(createEmptySingleWellSealEvaluationForm("2026-05-23").sealStats.length, 5);
});

test("second-batch modal payload normalizers trim and pad array input", () => {
  assert.deepEqual(normalizeSmartTestPayload({
    wellNo: " 智1 ",
    testDate: " 2026-05-23 ",
    allocatorCount: "5",
    dailyAllocation: ["30"],
    dailyInjection: ["31"],
    allocationDiff: ["1"],
    nozzleOpening: ["42"],
    wellheadPressure: " 12 ",
    innerPressure: ["11"],
    outerPressure: ["10"],
    remark: "",
  }).dailyAllocation, ["30", "-", "-", "-", "-"]);

  assert.deepEqual(normalizeSingleWellInjectionEvaluationPayload({
    wellNo: " 注1 ",
    process: " 同心分注 ",
    unit: " 采油作业一区 ",
    evaluationDate: "2026-05-23",
    intervalCount: "4",
    actualCount: "4",
    qualifiedCount: "3",
    unqualified: ["1"],
    remark: "",
  }), {
    wellNo: "注1",
    process: "同心分注",
    unit: "采油作业一区",
    evaluationDate: "2026-05-23",
    intervalCount: 4,
    actualCount: 4,
    qualifiedCount: 3,
    unqualified: ["1", "0", "0", "0", "0", "0"],
    remark: null,
  });

  assert.deepEqual(normalizeSingleWellSealEvaluationPayload({
    wellNo: " 封1 ",
    process: " 智能分注 ",
    evaluationDate: "2026-05-23",
    intervalCount: "4",
    actualCount: "4",
    needSealCount: "3",
    qualifiedSealCount: "2",
    sealStats: ["合格"],
  }).sealStats, ["合格", "-", "-", "-", "-"]);
});

test("filterDynamicAnalysisRowsByDiffThresholds applies absolute oil diff thresholds", () => {
  const rows = [
    { diffMonth: ["+5", "+1", "0.2%"], diffYear: ["+20", "+3", "0.5%"] },
    { diffMonth: ["+1", "+0.2", "0.1%"], diffYear: ["+10", "+0.2", "0.1%"] },
    { diffMonth: ["-6", "-0.8", "-4.1%"], diffYear: ["-8", "-0.4", "-2.5%"] },
  ];

  assert.deepEqual(
    filterDynamicAnalysisRowsByDiffThresholds(rows, {
      diffPeriod: "month",
      liquidDiffMin: "2",
      oilDiffMin: "0.5",
      waterDiffMin: "3",
    }),
    [rows[2]],
  );

  assert.deepEqual(
    filterDynamicAnalysisRowsByDiffThresholds(rows, {
      diffPeriod: "year",
      liquidDiffMin: "15",
      oilDiffMin: "2",
      waterDiffMin: "0.5",
    }),
    [rows[0]],
  );
});

test("filterDynamicAnalysisRowsByDiffThresholds applies water injection threshold", () => {
  const rows = [
    { diffMonth: ["+4", "+0.3", "+0.3"], diffYear: ["+15", "+0.6", "+0.6"] },
    { diffMonth: ["+1", "+0.1", "+0.1"], diffYear: ["+8", "+0.3", "+0.3"] },
    { diffMonth: ["-5", "-0.4", "-0.4"], diffYear: ["-12", "-0.5", "-0.5"] },
  ];

  assert.deepEqual(
    filterDynamicAnalysisRowsByDiffThresholds(rows, {
      diffPeriod: "month",
      injectionDiffMin: "4",
    }),
    [rows[0], rows[2]],
  );

  assert.deepEqual(
    filterDynamicAnalysisRowsByDiffThresholds(rows, {
      diffPeriod: "year",
      injectionDiffMin: "10",
    }),
    [rows[0], rows[2]],
  );
});
