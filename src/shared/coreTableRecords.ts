import { DYNAMIC_ADJUSTMENT_PURPOSES } from "./dynamicAdjustment";
import { getAllRawBlocksForConsolidated } from "./oilProductionBlocks";
import { getAllWaterRawBlocksForConsolidated } from "./waterInjectionBlocks";

export type PaginationInput = { page?: unknown; pageSize?: unknown };

export type WaterCutSeedRow = {
  unit: string;
  block: string;
  wellNo: string;
  sampleDate: string;
  waterCut: number;
  tester: string;
  remark?: string | null;
};

export type InjectionTechSeedRow = {
  wellNo: string;
  block: string;
  workArea: string;
  process: string;
  packerCount: number;
  packerModels: string[];
  bottomStructure: string;
  washable: string;
  doublePacker: string;
  washReminder: string | null;
  lastWorkDate: string;
  runningDate: string;
};

export type WellFlushingSeedRow = {
  unit: string;
  block: string;
  wellNo: string;
  washDate: string;
  daysSinceLastWash: number;
  method: string;
  equipmentPressure: number | null;
  duration: number | null;
  totalWater: number | null;
  firstLevel: string[];
  secondLevel: string[];
  suspendedMatter: string[];
  remark: string | null;
};

export type WellFlushingForm = {
  unit: string;
  block: string;
  wellNo: string;
  washDate: string;
  daysSinceLastWash: string;
  method: string;
  equipmentPressure: string;
  duration: string;
  totalWater: string;
  firstLevel: string[];
  secondLevel: string[];
  suspendedMatter: string[];
  remark: string;
};

type WellFlushingBaseRow = Omit<WellFlushingSeedRow, "equipmentPressure" | "duration" | "totalWater"> & {
  equipmentPressure: number;
  duration: number;
  totalWater: number;
};

export type AbnormalWellSeedRow = {
  category: string;
  wellNo: string;
  block: string;
  unit: string;
  process: string;
  normalDaily: string | null;
  normalOilPressure: string | null;
  normalCasingPressure: string | null;
  normalLayerPressure: string | null;
  abnormalDaily: string | null;
  abnormalOilPressure: string | null;
  abnormalCasingPressure: string | null;
  abnormalLayerPressure: string | null;
  suggestion: string | null;
};

export type AbnormalWellForm = {
  category: string;
  wellNo: string;
  block: string;
  unit: string;
  process: string;
  normalDaily: string;
  normalOilPressure: string;
  normalCasingPressure: string;
  normalLayerPressure: string;
  abnormalDaily: string;
  abnormalOilPressure: string;
  abnormalCasingPressure: string;
  abnormalLayerPressure: string;
  suggestion: string;
};

export type DynamicAdjustmentSeedRow = {
  id: string;
  adjustmentWaterWell: string;
  injectionProcess: string;
  adjustmentDate: string;
  beforeDailyInjection: number;
  afterDailyInjection: number;
  adjustmentPurpose: string;
  trackedOilWell: string;
  beforeDailyLiquid: number;
  beforeDailyOil: number;
  beforeWaterCut: number;
  afterDailyLiquid: number;
  afterDailyOil: number;
  afterWaterCut: number;
  diffDailyLiquid: number | null;
  diffDailyOil: number | null;
  diffWaterCut: number | null;
  stageDays: number;
  cumulativeOil: number;
  remark: string | null;
};

const trim = (value: unknown) => String(value ?? "").trim();

const toNullableSeedText = (value: string) => value || null;

const roundToOne = (value: number) => Number(value.toFixed(1));

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toValidDate = (value: unknown, endOfDay = false) => {
  const text = trim(value);
  if (!text) return null;
  const date = new Date(`${text}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function normalizePagination(input: PaginationInput) {
  const rawPage = Number(input.page ?? 1);
  const rawPageSize = Number(input.pageSize ?? 15);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), 100) : 15;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function toNullableText(value: unknown) {
  const text = trim(value);
  return text || null;
}

export function toNumberOrNull(value: unknown) {
  const text = trim(value).replace(/%$/, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

const toIntegerOrNull = (value: unknown) => {
  const parsed = toNumberOrNull(value);
  return parsed === null ? null : Math.trunc(parsed);
};

const toStringList = (value: unknown, length?: number) => {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const values = source.map((item) => trim(item));
  return typeof length === "number"
    ? Array.from({ length }, (_, index) => values[index] ?? "")
    : values;
};

export function buildDateRange(fromDate?: unknown, toDate?: unknown) {
  const from = toValidDate(fromDate);
  const to = toValidDate(toDate, true);
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

export function normalizeWaterCutPayload(input: Record<string, unknown>) {
  return {
    unit: trim(input.unit),
    block: trim(input.block),
    wellNo: trim(input.wellNo),
    sampleDate: trim(input.sampleDate),
    waterCut: toNumberOrNull(input.waterCut),
    tester: trim(input.tester),
    remark: toNullableText(input.remark),
  };
}

export function createEmptyWellFlushingForm(defaultDate = new Date().toISOString().slice(0, 10)): WellFlushingForm {
  return {
    unit: "高采采油作业一区",
    block: "",
    wellNo: "",
    washDate: defaultDate,
    daysSinceLastWash: "0",
    method: "洗井车",
    equipmentPressure: "",
    duration: "",
    totalWater: "",
    firstLevel: ["", "", "", "", ""],
    secondLevel: ["", "", "", "", ""],
    suspendedMatter: ["", "", ""],
    remark: "",
  };
}

export function normalizeWellFlushingPayload(input: Record<string, unknown>): WellFlushingSeedRow {
  return {
    unit: trim(input.unit),
    block: trim(input.block),
    wellNo: trim(input.wellNo),
    washDate: trim(input.washDate),
    daysSinceLastWash: toIntegerOrNull(input.daysSinceLastWash) ?? 0,
    method: trim(input.method),
    equipmentPressure: toNumberOrNull(input.equipmentPressure),
    duration: toNumberOrNull(input.duration),
    totalWater: toNumberOrNull(input.totalWater),
    firstLevel: toStringList(input.firstLevel, 5),
    secondLevel: toStringList(input.secondLevel, 5),
    suspendedMatter: toStringList(input.suspendedMatter, 3),
    remark: toNullableText(input.remark),
  };
}

export function createEmptyAbnormalWellForm(): AbnormalWellForm {
  return {
    category: "欠注",
    wellNo: "",
    block: "",
    unit: "高采采油作业一区",
    process: "分注",
    normalDaily: "",
    normalOilPressure: "",
    normalCasingPressure: "",
    normalLayerPressure: "",
    abnormalDaily: "",
    abnormalOilPressure: "",
    abnormalCasingPressure: "",
    abnormalLayerPressure: "",
    suggestion: "",
  };
}

export function normalizeAbnormalWellPayload(input: Record<string, unknown>): AbnormalWellSeedRow {
  return {
    category: trim(input.category),
    wellNo: trim(input.wellNo),
    block: trim(input.block),
    unit: trim(input.unit),
    process: trim(input.process),
    normalDaily: toNullableText(input.normalDaily),
    normalOilPressure: toNullableText(input.normalOilPressure),
    normalCasingPressure: toNullableText(input.normalCasingPressure),
    normalLayerPressure: toNullableText(input.normalLayerPressure),
    abnormalDaily: toNullableText(input.abnormalDaily),
    abnormalOilPressure: toNullableText(input.abnormalOilPressure),
    abnormalCasingPressure: toNullableText(input.abnormalCasingPressure),
    abnormalLayerPressure: toNullableText(input.abnormalLayerPressure),
    suggestion: toNullableText(input.suggestion),
  };
}

export function buildWaterCutWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  if (trim(query.unit)) where.unit = trim(query.unit);
  if (trim(query.block)) {
    const rawBlocks = getAllRawBlocksForConsolidated(trim(query.block));
    where.block = rawBlocks.length > 0 ? { in: rawBlocks } : trim(query.block);
  }
  if (trim(query.wellNo)) where.wellNo = { contains: trim(query.wellNo), mode: "insensitive" };
  if (trim(query.waterCutRange) === "90-") where.waterCut = { lt: 90 };
  if (trim(query.waterCutRange) === "90-92") where.waterCut = { gte: 90, lt: 92 };
  if (trim(query.waterCutRange) === "92-94") where.waterCut = { gte: 92, lt: 94 };
  if (trim(query.waterCutRange) === "94+") where.waterCut = { gte: 94 };
  const dateRange = buildDateRange(query.fromDate, query.toDate);
  if (Object.keys(dateRange).length) where.sampleDate = dateRange;
  return where;
}

export function buildAbnormalWellWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  if (trim(query.unit)) where.unit = trim(query.unit);
  if (trim(query.block)) {
    const rawBlocks = getAllWaterRawBlocksForConsolidated(trim(query.block));
    where.block = rawBlocks.length > 0 ? { in: rawBlocks } : trim(query.block);
  }
  if (trim(query.category)) where.category = trim(query.category);
  if (trim(query.process)) where.process = trim(query.process);
  if (trim(query.wellNo)) where.wellNo = { contains: trim(query.wellNo), mode: "insensitive" };
  return where;
}

const WATER_CUT_TESTERS = ["张三", "李四", "王五", "赵六", "孙七", "周八", "吴九", "郑十"];

const buildWaterCutSeedRows = (): WaterCutSeedRow[] =>
  Array.from({ length: 75 }, (_, index) => {
    const serial = index + 1;
    const waterCut = Number((90 + ((index * 7) % 46) / 10).toFixed(1));

    return {
      unit: `采油作业${index % 3 === 1 ? "二" : index % 3 === 2 ? "三" : "一"}区`,
      block: `区块${String.fromCharCode(65 + (index % 5))}`,
      wellNo: `GS-${String(200 + serial).padStart(3, "0")}`,
      sampleDate: `2024-04-${String(10 + (index % 18)).padStart(2, "0")}`,
      waterCut,
      tester: WATER_CUT_TESTERS[index % WATER_CUT_TESTERS.length],
    };
  });

const INJECTION_TECH_BASE_ROWS: InjectionTechSeedRow[] = [
  {
    wellNo: "雷19-10",
    block: "雷家L",
    workArea: "高采采油作业一区",
    process: "分层注水",
    packerCount: 3,
    packerModels: ["Y341-114", "Y341-114", "Y341-114", "", "", ""],
    bottomStructure: "球座+筛管",
    washable: "是",
    doublePacker: "否",
    washReminder: "低排量反洗",
    lastWorkDate: "2026-05-06",
    runningDate: "2026-05-08",
  },
  {
    wellNo: "雷20-12侧",
    block: "雷家L",
    workArea: "高采采油作业一区",
    process: "偏心分注",
    packerCount: 2,
    packerModels: ["Y341-115", "Y341-115", "", "", "", ""],
    bottomStructure: "丝堵",
    washable: "是",
    doublePacker: "是",
    washReminder: "注意压差",
    lastWorkDate: "2026-04-22",
    runningDate: "2026-04-24",
  },
  {
    wellNo: "雷21-10",
    block: "雷家L",
    workArea: "高采采油作业一区",
    process: "同心分注",
    packerCount: 4,
    packerModels: ["K344-114", "K344-114", "Y341-114", "Y341-114", "", ""],
    bottomStructure: "导锥",
    washable: "否",
    doublePacker: "是",
    washReminder: "暂不洗井",
    lastWorkDate: "2026-03-18",
    runningDate: "2026-03-20",
  },
  {
    wellNo: "高2-06-2",
    block: "雷家L",
    workArea: "高采采油作业一区",
    process: "笼统注水",
    packerCount: 1,
    packerModels: ["Y221-114", "", "", "", "", ""],
    bottomStructure: "喇叭口",
    washable: "是",
    doublePacker: "否",
    washReminder: "常规洗井",
    lastWorkDate: "2026-02-27",
    runningDate: "2026-03-01",
  },
  {
    wellNo: "高603",
    block: "高18(南)",
    workArea: "高采采油作业一区",
    process: "桥式偏心",
    packerCount: 5,
    packerModels: ["Y341-114", "Y341-114", "Y341-115", "Y341-115", "Y211-114", ""],
    bottomStructure: "单流阀",
    washable: "是",
    doublePacker: "是",
    washReminder: "分段观察",
    lastWorkDate: "2026-01-15",
    runningDate: "2026-01-18",
  },
  {
    wellNo: "雷25-21",
    block: "雷家L",
    workArea: "高采采油作业一区",
    process: "分层配注",
    packerCount: 2,
    packerModels: ["K344-114", "Y341-114", "", "", "", ""],
    bottomStructure: "筛管",
    washable: "否",
    doublePacker: "否",
    washReminder: "压力偏高",
    lastWorkDate: "2025-12-09",
    runningDate: "2025-12-12",
  },
];

const buildInjectionTechSeedRows = (): InjectionTechSeedRow[] =>
  Array.from({ length: 50 }, (_, index) => {
    const source = INJECTION_TECH_BASE_ROWS[index % INJECTION_TECH_BASE_ROWS.length];
    const displayNo = index + 1;
    const month = String((index % 12) + 1).padStart(2, "0");
    const day = String((index % 27) + 1).padStart(2, "0");

    return {
      ...source,
      wellNo: index < INJECTION_TECH_BASE_ROWS.length ? source.wellNo : `${source.wellNo}-${String(displayNo).padStart(2, "0")}`,
      packerModels: [...source.packerModels],
      lastWorkDate: `2026-${month}-${day}`,
      runningDate: `2026-${month}-${String(Math.min(Number(day) + 2, 28)).padStart(2, "0")}`,
    };
  });

const WELL_FLUSHING_BASE_ROWS: WellFlushingBaseRow[] = [
  {
    unit: "高采采油作业一区",
    block: "?11",
    wellNo: "GS-101",
    washDate: "2026-05-20",
    daysSinceLastWash: 128,
    method: "洗井车",
    equipmentPressure: 12.5,
    duration: 4.5,
    totalWater: 92,
    firstLevel: ["18", "23", "5", "1.2", "4.2"],
    secondLevel: ["28", "36", "8", "1.8", "4.4"],
    suspendedMatter: ["18.6", "7.4", "11.2"],
    remark: "洗井正常",
  },
  {
    unit: "高采采油作业一区",
    block: "?11",
    wellNo: "GS-102",
    washDate: "2026-05-18",
    daysSinceLastWash: 96,
    method: "泵车",
    equipmentPressure: 11.2,
    duration: 3.8,
    totalWater: 76,
    firstLevel: ["16", "20", "4", "1.0", "4.0"],
    secondLevel: ["25", "31", "6", "1.5", "4.0"],
    suspendedMatter: ["21.3", "9.5", "11.8"],
    remark: "返水清澈",
  },
  {
    unit: "高采采油作业二区",
    block: "?????",
    wellNo: "GS-103",
    washDate: "2026-05-15",
    daysSinceLastWash: 154,
    method: "来水",
    equipmentPressure: 10.6,
    duration: 5,
    totalWater: 105,
    firstLevel: ["20", "27", "7", "1.4", "5.0"],
    secondLevel: ["30", "41", "11", "2.1", "5.2"],
    suspendedMatter: ["19.8", "8.1", "11.7"],
    remark: "建议复测",
  },
];

const buildWellFlushingSeedRows = (): WellFlushingSeedRow[] =>
  Array.from({ length: 38 }, (_, index) => {
    const base = WELL_FLUSHING_BASE_ROWS[index % WELL_FLUSHING_BASE_ROWS.length];
    const day = 20 - (index % 20);
    const offset = index % 9;

    return {
      ...base,
      unit: index % 2 === 0 ? "高采采油作业一区" : "高采采油作业二区",
      wellNo: `GS-${String(index + 101).padStart(3, "0")}`,
      washDate: `2026-05-${String(day).padStart(2, "0")}`,
      daysSinceLastWash: 80 + index * 3,
      equipmentPressure: Number((10.2 + offset * 0.4).toFixed(1)),
      duration: Number((3.2 + (index % 6) * 0.3).toFixed(1)),
      totalWater: 72 + index * 2,
      firstLevel: [
        String(14 + offset),
        String(19 + offset),
        String(5 + (index % 4)),
        (1 + (index % 5) * 0.1).toFixed(1),
        (4 + (index % 4) * 0.2).toFixed(1),
      ],
      secondLevel: [
        String(24 + offset),
        String(31 + offset),
        String(7 + (index % 5)),
        (1.5 + (index % 4) * 0.2).toFixed(1),
        (4.1 + (index % 5) * 0.2).toFixed(1),
      ],
      suspendedMatter: [
        (18 + offset * 0.7).toFixed(1),
        (7 + (index % 6) * 0.4).toFixed(1),
        (10.6 + (index % 5) * 0.3).toFixed(1),
      ],
      remark: index % 5 === 0 ? "建议复测" : index % 3 === 0 ? "返水清澈" : "洗井正常",
    };
  });

const ABNORMAL_WELL_TEMPLATE_ROWS = [
  {
    category: "欠注",
    normalDaily: "50（15/15/20）",
    normalOilPressure: "",
    normalCasingPressure: "",
    normalLayerPressure: "地面定量分注填",
    abnormalDaily: "",
    abnormalOilPressure: "",
    abnormalCasingPressure: "",
    abnormalLayerPressure: "",
    suggestion: "",
  },
  {
    category: "封隔器失效",
    normalDaily: "",
    normalOilPressure: "",
    normalCasingPressure: "",
    normalLayerPressure: "",
    abnormalDaily: "",
    abnormalOilPressure: "",
    abnormalCasingPressure: "",
    abnormalLayerPressure: "",
    suggestion: "",
  },
];

const buildAbnormalWellSeedRows = (): AbnormalWellSeedRow[] =>
  Array.from({ length: 38 }, (_, index) => {
    const template = ABNORMAL_WELL_TEMPLATE_ROWS[index % ABNORMAL_WELL_TEMPLATE_ROWS.length];

    return {
      ...template,
      wellNo: `GS-${String(index + 1).padStart(3, "0")}`,
      block: `区块${(index % 3) + 1}`,
      unit: `采油作业${["一", "二", "三"][index % 3]}区`,
      process: ["分注", "同心分注", "智能分注"][index % 3],
      normalDaily: toNullableSeedText(template.normalDaily),
      normalOilPressure: toNullableSeedText(template.normalOilPressure),
      normalCasingPressure: toNullableSeedText(template.normalCasingPressure),
      normalLayerPressure: toNullableSeedText(template.normalLayerPressure),
      abnormalDaily: toNullableSeedText(template.abnormalDaily),
      abnormalOilPressure: toNullableSeedText(template.abnormalOilPressure),
      abnormalCasingPressure: toNullableSeedText(template.abnormalCasingPressure),
      abnormalLayerPressure: toNullableSeedText(template.abnormalLayerPressure),
      suggestion: toNullableSeedText(template.suggestion),
    };
  });

const buildDynamicAdjustmentSeedRows = (): DynamicAdjustmentSeedRow[] =>
  Array.from({ length: 38 }, (_, index) => {
    const beforeDailyLiquid = roundToOne(7 + (index % 5) * 0.6);
    const beforeDailyOil = roundToOne(2.4 + (index % 4) * 0.3);
    const beforeWaterCut = roundToOne(32 + (index % 6) * 2);
    const afterDailyLiquid = roundToOne(beforeDailyLiquid + 0.8);
    const afterDailyOil = roundToOne(beforeDailyOil + 0.4);
    const afterWaterCut = roundToOne(beforeWaterCut - 1.5);

    return {
      id: `mock-dynamic-adjustment-${index + 1}`,
      adjustmentWaterWell: `高注-${String(index + 1).padStart(3, "0")}`,
      injectionProcess: ["分注", "同心分注", "智能分注"][index % 3],
      adjustmentDate: `2026-05-${String((index % 28) + 1).padStart(2, "0")}`,
      beforeDailyInjection: 40 + (index % 7) * 2,
      afterDailyInjection: 44 + (index % 7) * 2,
      adjustmentPurpose: DYNAMIC_ADJUSTMENT_PURPOSES[index % DYNAMIC_ADJUSTMENT_PURPOSES.length],
      trackedOilWell: `高油-${String(index + 1).padStart(3, "0")}`,
      beforeDailyLiquid,
      beforeDailyOil,
      beforeWaterCut,
      afterDailyLiquid,
      afterDailyOil,
      afterWaterCut,
      diffDailyLiquid: roundToTwo(afterDailyLiquid - beforeDailyLiquid),
      diffDailyOil: roundToTwo(afterDailyOil - beforeDailyOil),
      diffWaterCut: roundToTwo(afterWaterCut - beforeWaterCut),
      stageDays: 10 + (index % 5) * 5,
      cumulativeOil: roundToOne(4 + (index % 8) * 1.2),
      remark: null,
    };
  });

export function buildCoreTableSeedRows() {
  return {
    waterCuts: buildWaterCutSeedRows(),
    injectionTechRecords: buildInjectionTechSeedRows(),
    wellFlushingRecords: buildWellFlushingSeedRows(),
    abnormalWellRecords: buildAbnormalWellSeedRows(),
    dynamicAdjustments: buildDynamicAdjustmentSeedRows(),
  };
}
