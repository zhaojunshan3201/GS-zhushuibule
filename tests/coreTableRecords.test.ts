import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAbnormalWellWhere,
  buildCoreTableSeedRows,
  buildDateRange,
  buildWaterCutWhere,
  createEmptyAbnormalWellForm,
  createEmptyWellFlushingForm,
  normalizeAbnormalWellPayload,
  normalizePagination,
  normalizeWellFlushingPayload,
  normalizeWaterCutPayload,
} from "../src/shared/coreTableRecords";

test("normalizePagination clamps invalid page and pageSize", () => {
  assert.deepEqual(normalizePagination({ page: "0", pageSize: "500" }), {
    page: 1,
    pageSize: 100,
    skip: 0,
    take: 100,
  });
});

test("buildDateRange creates inclusive UTC day bounds", () => {
  assert.deepEqual(buildDateRange("2026-05-01", "2026-05-03"), {
    gte: new Date("2026-05-01T00:00:00.000Z"),
    lte: new Date("2026-05-03T23:59:59.999Z"),
  });
});

test("buildDateRange ignores invalid date strings", () => {
  assert.deepEqual(buildDateRange("not-a-date", "2026-13-40"), {});
  assert.deepEqual(buildDateRange("2026-05-01", "bad-to-date"), {
    gte: new Date("2026-05-01T00:00:00.000Z"),
  });
});

test("normalizeWaterCutPayload trims fields and converts water cut to number", () => {
  assert.deepEqual(
    normalizeWaterCutPayload({
      unit: " 采油作业一区 ",
      block: " 区块A ",
      wellNo: " GS-201 ",
      sampleDate: "2026-05-20",
      waterCut: "92.5%",
      tester: " 张三 ",
      remark: " 正常 ",
    }),
    {
      unit: "采油作业一区",
      block: "区块A",
      wellNo: "GS-201",
      sampleDate: "2026-05-20",
      waterCut: 92.5,
      tester: "张三",
      remark: "正常",
    },
  );
});

test("buildWaterCutWhere keeps filtering on the server side shape", () => {
  assert.deepEqual(buildWaterCutWhere({ unit: "采油作业一区", wellNo: "GS", waterCutRange: "94+" }), {
    unit: "采油作业一区",
    wellNo: { contains: "GS", mode: "insensitive" },
    waterCut: { gte: 94 },
  });
});

test("buildAbnormalWellWhere supports category and well number filters", () => {
  assert.deepEqual(buildAbnormalWellWhere({ category: "欠注", wellNo: "GS-0" }), {
    category: "欠注",
    wellNo: { contains: "GS-0", mode: "insensitive" },
  });
});

test("createEmptyWellFlushingForm prepares segmented flushing fields", () => {
  const form = createEmptyWellFlushingForm("2026-05-23");

  assert.equal(form.washDate, "2026-05-23");
  assert.equal(form.daysSinceLastWash, "0");
  assert.deepEqual(form.firstLevel, ["", "", "", "", ""]);
  assert.deepEqual(form.secondLevel, ["", "", "", "", ""]);
  assert.deepEqual(form.suspendedMatter, ["", "", ""]);
});

test("normalizeWellFlushingPayload trims and converts modal input", () => {
  const result = normalizeWellFlushingPayload({
    unit: " 采油作业一区 ",
    wellNo: " W1 ",
    washDate: " 2026-05-23 ",
    daysSinceLastWash: "12",
    method: " 洗井车 ",
    equipmentPressure: "10.5",
    duration: "",
    totalWater: "30",
    firstLevel: ["1", ""],
    secondLevel: ["2"],
    suspendedMatter: ["洗前", ""],
    remark: " 新增 ",
  });

  assert.deepEqual(result, {
    unit: "采油作业一区",
    wellNo: "W1",
    washDate: "2026-05-23",
    daysSinceLastWash: 12,
    method: "洗井车",
    equipmentPressure: 10.5,
    duration: null,
    totalWater: 30,
    firstLevel: ["1", "", "", "", ""],
    secondLevel: ["2", "", "", "", ""],
    suspendedMatter: ["洗前", "", ""],
    remark: "新增",
  });
});

test("createEmptyAbnormalWellForm and normalizeAbnormalWellPayload support modal add", () => {
  const form = createEmptyAbnormalWellForm();
  assert.equal(form.category, "欠注");
  assert.equal(form.unit, "采油作业一区");

  assert.deepEqual(normalizeAbnormalWellPayload({
    category: " 欠注 ",
    wellNo: " A1 ",
    block: " 区块1 ",
    unit: " 采油作业一区 ",
    process: " 分注 ",
    normalDaily: "",
    abnormalDaily: "10",
    suggestion: " 复核 ",
  }), {
    category: "欠注",
    wellNo: "A1",
    block: "区块1",
    unit: "采油作业一区",
    process: "分注",
    normalDaily: null,
    normalOilPressure: null,
    normalCasingPressure: null,
    normalLayerPressure: null,
    abnormalDaily: "10",
    abnormalOilPressure: null,
    abnormalCasingPressure: null,
    abnormalLayerPressure: null,
    suggestion: "复核",
  });
});

test("buildCoreTableSeedRows provides first-batch seed data", () => {
  const seeds = buildCoreTableSeedRows();

  assert.equal(seeds.waterCuts.length, 75);
  assert.equal(seeds.injectionTechRecords.length, 50);
  assert.equal(seeds.wellFlushingRecords.length, 38);
  assert.equal(seeds.abnormalWellRecords.length, 38);
  assert.equal(seeds.dynamicAdjustments.length, 38);
  assert.deepEqual(seeds.waterCuts[0], {
    unit: "采油作业一区",
    block: "区块A",
    wellNo: "GS-201",
    sampleDate: "2024-04-10",
    waterCut: 90,
    tester: "张三",
  });
  assert.equal(seeds.injectionTechRecords[0].wellNo, "雷19-10");
  assert.equal(seeds.wellFlushingRecords[0].wellNo, "GS-101");
  assert.equal(typeof seeds.wellFlushingRecords[0].equipmentPressure, "number");
  assert.equal(typeof seeds.wellFlushingRecords[0].duration, "number");
  assert.equal(typeof seeds.wellFlushingRecords[0].totalWater, "number");
  assert.equal(seeds.wellFlushingRecords[0].firstLevel.length, 5);
  assert.equal(seeds.wellFlushingRecords[0].secondLevel.length, 5);
  assert.equal(seeds.wellFlushingRecords[0].suspendedMatter.length, 3);
  assert.equal(seeds.abnormalWellRecords[0].wellNo, "GS-001");
  assert.equal(seeds.dynamicAdjustments[0].adjustmentWaterWell, "高注-001");
});
