import { buildDateRange } from "./coreTableRecords";
import { getAllRawBlocksForConsolidated } from "./oilProductionBlocks";

export type AdaptiveTablePageSizeInput = {
  viewportHeight: number;
  tableTop: number;
  reservedHeight?: number;
  rowHeight?: number;
  minRows?: number;
  maxRows?: number;
};

export function calculateAdaptiveTablePageSize({
  viewportHeight,
  tableTop,
  reservedHeight = 184,
  rowHeight = 41,
  minRows = 10,
  maxRows = 25,
}: AdaptiveTablePageSizeInput): number {
  if (
    !Number.isFinite(viewportHeight)
    || !Number.isFinite(tableTop)
    || !Number.isFinite(reservedHeight)
    || !Number.isFinite(rowHeight)
    || rowHeight <= 0
  ) {
    return minRows;
  }

  const rows = Math.floor((viewportHeight - tableTop - reservedHeight) / rowHeight);
  return Math.min(maxRows, Math.max(minRows, rows));
}

export function mapPageForPageSizeChange(
  currentPage: number,
  currentPageSize: number,
  nextPageSize: number,
): number {
  const safePage = Number.isFinite(currentPage) && currentPage > 0 ? Math.floor(currentPage) : 1;
  const safeCurrentSize = Number.isFinite(currentPageSize) && currentPageSize > 0 ? Math.floor(currentPageSize) : 10;
  const safeNextSize = Number.isFinite(nextPageSize) && nextPageSize > 0 ? Math.floor(nextPageSize) : 10;
  const firstRecordIndex = (safePage - 1) * safeCurrentSize;
  return Math.floor(firstRecordIndex / safeNextSize) + 1;
}

export type ConcentricTestSeedRow = {
  unit: string;
  block: string;
  wellNo: string;
  testDate: string;
  allocatorCount: number;
  freedom: string | null;
  partialStroke: string | null;
  fullyStuck: string | null;
  layerFreedom: string[];
  dailyInjection: string[];
  remark: string | null;
};

export type ConcentricTestForm = {
  unit: string;
  block: string;
  wellNo: string;
  testDate: string;
  allocatorCount: string;
  freedom: string;
  partialStroke: string;
  fullyStuck: string;
  layerFreedom: string[];
  dailyInjection: string[];
  remark: string;
};

export type NormalizedConcentricTestPayload = {
  unit: string;
  block: string;
  wellNo: string;
  testDate: string;
  allocatorCount: number;
  freedom: string | null;
  partialStroke: string | null;
  fullyStuck: string | null;
  layerFreedom: string[];
  dailyInjection: string[];
  remark: string | null;
};

export type SmartTestSeedRow = {
  unit: string;
  block: string;
  wellNo: string;
  testDate: string;
  allocatorCount: number;
  dailyAllocation: string[];
  dailyInjection: string[];
  allocationDiff: string[];
  nozzleOpening: string[];
  wellheadPressure: string;
  innerPressure: string[];
  outerPressure: string[];
  remark: string | null;
};

export type SmartTestForm = {
  unit: string;
  block: string;
  wellNo: string;
  testDate: string;
  allocatorCount: string;
  dailyAllocation: string[];
  dailyInjection: string[];
  allocationDiff: string[];
  nozzleOpening: string[];
  wellheadPressure: string;
  innerPressure: string[];
  outerPressure: string[];
  remark: string;
};

export type NormalizedSmartTestPayload = Omit<SmartTestSeedRow, never> & {
  allocatorCount: number;
};

export type SingleWellInjectionEvaluationSeedRow = {
  wellNo: string;
  process: string;
  unit: string;
  block: string;
  evaluationDate: string;
  intervalCount: number;
  actualCount: number;
  qualifiedCount: number;
  unqualified: string[];
  remark: string | null;
};

export type SingleWellInjectionEvaluationForm = {
  wellNo: string;
  process: string;
  unit: string;
  block: string;
  evaluationDate: string;
  intervalCount: string;
  actualCount: string;
  qualifiedCount: string;
  unqualified: string[];
  remark: string;
};

export type NormalizedSingleWellInjectionEvaluationPayload = SingleWellInjectionEvaluationSeedRow;

export type SingleWellSealEvaluationSeedRow = {
  unit: string;
  block: string;
  wellNo: string;
  process: string;
  evaluationDate: string;
  intervalCount: number;
  actualCount: number;
  needSealCount: number;
  qualifiedSealCount: number;
  sealStats: string[];
};

export type SingleWellSealEvaluationForm = {
  unit: string;
  block: string;
  wellNo: string;
  process: string;
  evaluationDate: string;
  intervalCount: string;
  actualCount: string;
  needSealCount: string;
  qualifiedSealCount: string;
  sealStats: string[];
};

export type NormalizedSingleWellSealEvaluationPayload = SingleWellSealEvaluationSeedRow;

export type ZonalIndicatorSummarySeedRow = {
  category: string;
  process: string;
  wellCount: number;
  processRate: string;
  intervalCount: number;
  actualCount: number;
  level: string;
  segmentSeal: string[];
  fullSeal: string[];
  allocation: string[];
  sortOrder: number;
};

export type DynamicAnalysisSeedRow = {
  kind: "overall-oil" | "overall-water" | "single-oil" | "single-water";
  unit: string;
  block: string;
  wellNo: string | null;
  endValues: string[];
  averageValues: string[];
  lastYearValues: string[];
  diffMonth: string[];
  diffYear: string[];
  advice: string[];
  status: string | null;
  process: string | null;
};

const trim = (value: unknown) => String(value ?? "").trim();
const textOrNull = (value: string) => value || null;
const toFixedStringArray = (value: unknown, length: number, fallback = "-") => {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, index) => trim(source[index]) || fallback);
};

export function createEmptyConcentricTestForm(defaultDate = new Date().toISOString().slice(0, 10)): ConcentricTestForm {
  return {
    unit: "高采采油作业一区",
    block: "",
    wellNo: "",
    testDate: defaultDate,
    allocatorCount: "4",
    freedom: "",
    partialStroke: "",
    fullyStuck: "",
    layerFreedom: ["", "", "", ""],
    dailyInjection: ["", "", "", ""],
    remark: "",
  };
}

export function normalizeConcentricTestPayload(input: Record<string, unknown>): NormalizedConcentricTestPayload {
  const freedom = trim(input.freedom);
  const partialStroke = trim(input.partialStroke);
  const fullyStuck = trim(input.fullyStuck);
  const remark = trim(input.remark);

  return {
    unit: trim(input.unit),
    block: trim(input.block),
    wellNo: trim(input.wellNo),
    testDate: trim(input.testDate),
    allocatorCount: Number(input.allocatorCount),
    freedom: textOrNull(freedom),
    partialStroke: textOrNull(partialStroke),
    fullyStuck: textOrNull(fullyStuck),
    layerFreedom: toFixedStringArray(input.layerFreedom, 4),
    dailyInjection: toFixedStringArray(input.dailyInjection, 4),
    remark: textOrNull(remark),
  };
}

export function createEmptySmartTestForm(defaultDate = new Date().toISOString().slice(0, 10)): SmartTestForm {
  return {
    unit: "高采采油作业一区",
    block: "",
    wellNo: "",
    testDate: defaultDate,
    allocatorCount: "5",
    dailyAllocation: ["", "", "", "", ""],
    dailyInjection: ["", "", "", "", ""],
    allocationDiff: ["", "", "", "", ""],
    nozzleOpening: ["", "", "", "", ""],
    wellheadPressure: "",
    innerPressure: ["", "", "", "", ""],
    outerPressure: ["", "", "", "", ""],
    remark: "",
  };
}

export function normalizeSmartTestPayload(input: Record<string, unknown>): NormalizedSmartTestPayload {
  const remark = trim(input.remark);
  return {
    unit: trim(input.unit),
    block: trim(input.block),
    wellNo: trim(input.wellNo),
    testDate: trim(input.testDate),
    allocatorCount: Number(input.allocatorCount),
    dailyAllocation: toFixedStringArray(input.dailyAllocation, 5),
    dailyInjection: toFixedStringArray(input.dailyInjection, 5),
    allocationDiff: toFixedStringArray(input.allocationDiff, 5),
    nozzleOpening: toFixedStringArray(input.nozzleOpening, 5),
    wellheadPressure: trim(input.wellheadPressure),
    innerPressure: toFixedStringArray(input.innerPressure, 5),
    outerPressure: toFixedStringArray(input.outerPressure, 5),
    remark: textOrNull(remark),
  };
}

export function createEmptySingleWellInjectionEvaluationForm(defaultDate = new Date().toISOString().slice(0, 10)): SingleWellInjectionEvaluationForm {
  return {
    wellNo: "",
    process: "",
    unit: "高采采油作业一区",
    block: "",
    evaluationDate: defaultDate,
    intervalCount: "4",
    actualCount: "4",
    qualifiedCount: "3",
    unqualified: ["", "", "", "", "", ""],
    remark: "",
  };
}

export function normalizeSingleWellInjectionEvaluationPayload(input: Record<string, unknown>): NormalizedSingleWellInjectionEvaluationPayload {
  const remark = trim(input.remark);
  return {
    wellNo: trim(input.wellNo),
    process: trim(input.process),
    unit: trim(input.unit),
    block: trim(input.block),
    evaluationDate: trim(input.evaluationDate),
    intervalCount: Number(input.intervalCount),
    actualCount: Number(input.actualCount),
    qualifiedCount: Number(input.qualifiedCount),
    unqualified: toFixedStringArray(input.unqualified, 6, "0"),
    remark: textOrNull(remark),
  };
}

export function createEmptySingleWellSealEvaluationForm(defaultDate = new Date().toISOString().slice(0, 10)): SingleWellSealEvaluationForm {
  return {
    unit: "高采采油作业一区",
    block: "",
    wellNo: "",
    process: "",
    evaluationDate: defaultDate,
    intervalCount: "4",
    actualCount: "4",
    needSealCount: "3",
    qualifiedSealCount: "2",
    sealStats: ["", "", "", "", ""],
  };
}

export function normalizeSingleWellSealEvaluationPayload(input: Record<string, unknown>): NormalizedSingleWellSealEvaluationPayload {
  return {
    unit: trim(input.unit),
    block: trim(input.block),
    wellNo: trim(input.wellNo),
    process: trim(input.process),
    evaluationDate: trim(input.evaluationDate),
    intervalCount: Number(input.intervalCount),
    actualCount: Number(input.actualCount),
    needSealCount: Number(input.needSealCount),
    qualifiedSealCount: Number(input.qualifiedSealCount),
    sealStats: toFixedStringArray(input.sealStats, 5),
  };
}

export function buildConcentricTestWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  if (trim(query.unit)) where.unit = { contains: trim(query.unit), mode: "insensitive" };
  if (trim(query.block)) where.block = { contains: trim(query.block), mode: "insensitive" };
  if (trim(query.wellNo)) where.wellNo = { contains: trim(query.wellNo), mode: "insensitive" };
  const dateRange = buildDateRange(query.fromDate, query.toDate);
  if (Object.keys(dateRange).length) where.testDate = dateRange;
  return where;
}

export function buildSingleWellEvaluationWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  if (trim(query.unit)) where.unit = { contains: trim(query.unit), mode: "insensitive" };
  if (trim(query.block)) where.block = { contains: trim(query.block), mode: "insensitive" };
  if (trim(query.process)) where.process = trim(query.process);
  if (trim(query.wellNo)) where.wellNo = { contains: trim(query.wellNo), mode: "insensitive" };
  const dateRange = buildDateRange(query.fromDate, query.toDate);
  if (Object.keys(dateRange).length) where.evaluationDate = dateRange;
  return where;
}

export function buildZonalIndicatorSummaryWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  if (trim(query.category)) where.category = trim(query.category);
  if (trim(query.process)) where.process = { contains: trim(query.process), mode: "insensitive" };
  return where;
}

export function buildDynamicAnalysisWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  if (trim(query.kind)) where.kind = trim(query.kind);
  if (trim(query.unit)) where.unit = trim(query.unit);
  if (trim(query.block)) {
    const rawBlocks = getAllRawBlocksForConsolidated(trim(query.block));
    where.block = rawBlocks.length > 0 ? { in: rawBlocks } : trim(query.block);
  }
  if (trim(query.wellNo)) where.wellNo = { contains: trim(query.wellNo), mode: "insensitive" };
  return where;
}

type DynamicAnalysisDiffRow = {
  diffMonth?: unknown;
  diffYear?: unknown;
};

const toThresholdNumber = (value: unknown) => {
  const text = trim(value).replace(/%$/, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const diffValueAt = (values: unknown, index: number) => {
  if (!Array.isArray(values)) return null;
  return toThresholdNumber(values[index]);
};

export function filterDynamicAnalysisRowsByDiffThresholds<T extends DynamicAnalysisDiffRow>(
  rows: T[],
  query: Record<string, unknown>,
) {
  const injectionThreshold = toThresholdNumber(query.injectionDiffMin);
  if (injectionThreshold !== null) {
    const diffKey = trim(query.diffPeriod) === "year" ? "diffYear" : "diffMonth";
    return rows.filter((row) => {
      const value = diffValueAt(row[diffKey], 0);
      return value !== null && Math.abs(value) >= injectionThreshold;
    });
  }

  const thresholds = [
    toThresholdNumber(query.liquidDiffMin),
    toThresholdNumber(query.oilDiffMin),
    toThresholdNumber(query.waterDiffMin),
  ];
  if (thresholds.every((value) => value === null)) return rows;

  const diffKey = trim(query.diffPeriod) === "year" ? "diffYear" : "diffMonth";
  return rows.filter((row) =>
    thresholds.every((threshold, index) => {
      if (threshold === null) return true;
      const value = diffValueAt(row[diffKey], index);
      return value !== null && Math.abs(value) >= threshold;
    }),
  );
}

export function getDynamicAnalysisEmptyQueryMessage(rowCount: number, queryApplied: boolean) {
  if (!queryApplied || rowCount > 0) return null;
  return "未查询到符合所设置条件的井";
}

export function getDynamicAnalysisDeleteMessage(record: { wellNo?: string | null; block?: string | null }) {
  return `确认删除 ${record.wellNo || record.block || "该记录"} 的动态分析记录？`;
}

const CONCENTRIC_TEST_HISTORY_TEMPLATE_ROWS: Array<Omit<ConcentricTestSeedRow, "testDate" | "unit" | "block">> = [
  { wellNo: "雷19-10", allocatorCount: 4, freedom: "完全自由", partialStroke: null, fullyStuck: null, layerFreedom: ["完全自由", "完全自由", "部分行程", "完全自由"], dailyInjection: ["32.5", "28.0", "18.6", "21.4"], remark: "第3层行程偏小" },
  { wellNo: "雷20-12侧", allocatorCount: 3, freedom: null, partialStroke: "部分行程", fullyStuck: null, layerFreedom: ["完全自由", "部分行程", "完全自由", "-"], dailyInjection: ["25.2", "16.8", "19.5", "-"], remark: "建议跟踪复测" },
  { wellNo: "雷21-8", allocatorCount: 2, freedom: "完全自由", partialStroke: null, fullyStuck: null, layerFreedom: ["完全自由", "完全自由", "-", "-"], dailyInjection: ["30.0", "27.5", "-", "-"], remark: "正常" },
  { wellNo: "雷18-6", allocatorCount: 4, freedom: null, partialStroke: null, fullyStuck: "完全不动", layerFreedom: ["完全不动", "完全不动", "部分行程", "完全自由"], dailyInjection: ["0", "0", "12.4", "24.1"], remark: "上部两层需处理" },
  { wellNo: "雷22-15", allocatorCount: 3, freedom: null, partialStroke: "部分行程", fullyStuck: null, layerFreedom: ["部分行程", "完全自由", "完全自由", "-"], dailyInjection: ["20.6", "22.3", "26.8", "-"], remark: "一层调配后观察" },
];

const SMART_TEST_HISTORY_TEMPLATE_ROWS: Array<Omit<SmartTestSeedRow, "testDate" | "unit" | "block">> = [
  { wellNo: "雷19-10", allocatorCount: 5, dailyAllocation: ["30", "25", "20", "18", "12"], dailyInjection: ["31.5", "24.2", "19.8", "18.6", "11.7"], allocationDiff: ["+1.5", "-0.8", "-0.2", "+0.6", "-0.3"], nozzleOpening: ["42", "38", "35", "31", "26"], wellheadPressure: "12.6", innerPressure: ["11.8", "11.2", "10.7", "10.1", "9.5"], outerPressure: ["10.6", "10.1", "9.8", "9.2", "8.9"], remark: "正常" },
  { wellNo: "雷20-12侧", allocatorCount: 4, dailyAllocation: ["26", "22", "18", "14", "-"], dailyInjection: ["25.5", "21.0", "17.6", "13.9", "-"], allocationDiff: ["-0.5", "-1.0", "-0.4", "-0.1", "-"], nozzleOpening: ["40", "36", "30", "24", "-"], wellheadPressure: "11.9", innerPressure: ["11.0", "10.5", "10.0", "9.6", "-"], outerPressure: ["10.2", "9.7", "9.4", "9.0", "-"], remark: "四层偏低" },
  { wellNo: "雷21-8", allocatorCount: 3, dailyAllocation: ["28", "24", "20", "-", "-"], dailyInjection: ["28.6", "23.8", "20.4", "-", "-"], allocationDiff: ["+0.6", "-0.2", "+0.4", "-", "-"], nozzleOpening: ["39", "34", "30", "-", "-"], wellheadPressure: "12.2", innerPressure: ["11.5", "10.8", "10.2", "-", "-"], outerPressure: ["10.8", "10.0", "9.6", "-", "-"], remark: "正常" },
];

const buildConcentricTests = (): ConcentricTestSeedRow[] =>
  Array.from({ length: 26 }, (_, index) => {
    const template = CONCENTRIC_TEST_HISTORY_TEMPLATE_ROWS[index % CONCENTRIC_TEST_HISTORY_TEMPLATE_ROWS.length];
    const date = new Date(Date.UTC(2026, 4, 8 - index));
    return {
      ...template,
      unit: index % 3 === 1 ? "????????" : index % 3 === 2 ? "????????" : "????????",
      block: index % 3 === 1 ? "?????" : index % 3 === 2 ? "?3" : "?11",
      wellNo: `${template.wellNo}-${String(index + 1).padStart(2, "0")}`,
      testDate: date.toISOString().slice(0, 10),
    };
  });

const buildSmartTests = (): SmartTestSeedRow[] =>
  Array.from({ length: 26 }, (_, index) => {
    const template = SMART_TEST_HISTORY_TEMPLATE_ROWS[index % SMART_TEST_HISTORY_TEMPLATE_ROWS.length];
    const date = new Date(Date.UTC(2026, 4, 9 - index));
    return {
      ...template,
      unit: index % 3 === 1 ? "????????" : index % 3 === 2 ? "????????" : "????????",
      block: index % 3 === 1 ? "?????" : index % 3 === 2 ? "?3" : "?11",
      wellNo: `${template.wellNo}-${String(index + 1).padStart(2, "0")}`,
      testDate: date.toISOString().slice(0, 10),
    };
  });

const buildSingleWellInjectionEvaluations = (): SingleWellInjectionEvaluationSeedRow[] => {
  const templates = [
    { wellNo: "雷19-10", process: "同心分注", unit: "高采采油作业一区", intervalCount: 4, actualCount: 4, qualifiedCount: 3, unqualified: ["1", "0", "1", "0", "0", "0"], remark: "欠注1层" },
    { wellNo: "雷20-12侧", process: "智能分注", unit: "高采采油作业一区", intervalCount: 4, actualCount: 4, qualifiedCount: 4, unqualified: ["0", "0", "0", "0", "0", "0"], remark: "合格" },
    { wellNo: "雷21-8", process: "桥式同心", unit: "高采采油作业二区", intervalCount: 3, actualCount: 3, qualifiedCount: 2, unqualified: ["1", "1", "0", "0", "0", "0"], remark: "封隔器待复核" },
  ];
  return Array.from({ length: 38 }, (_, index) => {
    const template = templates[index % templates.length];
    const date = new Date(Date.UTC(2026, 4, 10 - index));
    return {
      ...template,
      block: index % 3 === 1 ? "牛心坨油层" : index % 3 === 2 ? "高3" : "雷11",
      wellNo: `${template.wellNo}-${String(index + 1).padStart(2, "0")}`,
      evaluationDate: date.toISOString().slice(0, 10),
    };
  });
};

const buildSingleWellSealEvaluations = (): SingleWellSealEvaluationSeedRow[] => {
  const templates = [
    { wellNo: "雷19-10", process: "同心分注", intervalCount: 4, actualCount: 4, needSealCount: 3, qualifiedSealCount: 2, sealStats: ["合格", "不合格", "合格", "-", "-"] },
    { wellNo: "雷20-12侧", process: "智能分注", intervalCount: 4, actualCount: 4, needSealCount: 3, qualifiedSealCount: 3, sealStats: ["合格", "合格", "合格", "-", "-"] },
    { wellNo: "雷21-8", process: "桥式同心", intervalCount: 3, actualCount: 3, needSealCount: 2, qualifiedSealCount: 1, sealStats: ["待核实", "合格", "-", "-", "-"] },
  ];
  return Array.from({ length: 38 }, (_, index) => {
    const template = templates[index % templates.length];
    const date = new Date(Date.UTC(2026, 4, 10 - index));
    return {
      ...template,
      unit: index % 3 === 1 ? "高采采油作业二区" : index % 3 === 2 ? "高采采油作业三区" : "高采采油作业一区",
      block: index % 3 === 1 ? "牛心坨油层" : index % 3 === 2 ? "高3" : "雷11",
      wellNo: `${template.wellNo}-${String(index + 1).padStart(2, "0")}`,
      evaluationDate: date.toISOString().slice(0, 10),
    };
  });
};

const buildZonalIndicatorSummaries = (): ZonalIndicatorSummarySeedRow[] => [
  { category: "地面定量", process: "油套", wellCount: 12, processRate: "18.5%", intervalCount: 36, actualCount: 35, level: "二级", segmentSeal: ["18", "17", "94.4%", "16", "88.9%"], fullSeal: ["12", "100%", "10", "83.3%"], allocation: ["35", "97.2%", "3", "32", "91.4%"], sortOrder: 1 },
  { category: "地面定量", process: "同心双管", wellCount: 8, processRate: "12.3%", intervalCount: 24, actualCount: 24, level: "二级", segmentSeal: ["12", "12", "100%", "11", "91.7%"], fullSeal: ["8", "100%", "7", "87.5%"], allocation: ["24", "100%", "2", "22", "91.7%"], sortOrder: 2 },
  { category: "地面定量", process: "同心三管", wellCount: 6, processRate: "9.2%", intervalCount: 24, actualCount: 23, level: "三级", segmentSeal: ["10", "9", "90.0%", "8", "80.0%"], fullSeal: ["6", "100%", "5", "83.3%"], allocation: ["23", "95.8%", "3", "20", "87.0%"], sortOrder: 3 },
  { category: "地面定量", process: "小计", wellCount: 26, processRate: "40.0%", intervalCount: 84, actualCount: 82, level: "-", segmentSeal: ["40", "38", "95.0%", "35", "87.5%"], fullSeal: ["26", "100%", "22", "84.6%"], allocation: ["82", "97.6%", "8", "74", "90.2%"], sortOrder: 4 },
  { category: "地下测调", process: "桥式同心", wellCount: 16, processRate: "24.6%", intervalCount: 48, actualCount: 47, level: "一级", segmentSeal: ["24", "23", "95.8%", "22", "91.7%"], fullSeal: ["16", "100%", "15", "93.8%"], allocation: ["47", "97.9%", "2", "45", "95.7%"], sortOrder: 5 },
  { category: "地下测调", process: "智能有缆", wellCount: 14, processRate: "21.5%", intervalCount: 56, actualCount: 55, level: "一级", segmentSeal: ["28", "27", "96.4%", "26", "92.9%"], fullSeal: ["14", "100%", "13", "92.9%"], allocation: ["55", "98.2%", "3", "52", "94.5%"], sortOrder: 6 },
  { category: "地下测调", process: "智能无缆", wellCount: 9, processRate: "13.9%", intervalCount: 36, actualCount: 35, level: "二级", segmentSeal: ["18", "17", "94.4%", "16", "88.9%"], fullSeal: ["9", "100%", "8", "88.9%"], allocation: ["35", "97.2%", "3", "32", "91.4%"], sortOrder: 7 },
  { category: "地下测调", process: "小计", wellCount: 39, processRate: "60.0%", intervalCount: 140, actualCount: 137, level: "-", segmentSeal: ["70", "67", "95.7%", "64", "91.4%"], fullSeal: ["39", "100%", "36", "92.3%"], allocation: ["137", "97.9%", "8", "129", "94.2%"], sortOrder: 8 },
  { category: "合计", process: "合计", wellCount: 65, processRate: "100%", intervalCount: 224, actualCount: 219, level: "-", segmentSeal: ["110", "105", "95.5%", "99", "90.0%"], fullSeal: ["65", "100%", "58", "89.2%"], allocation: ["219", "97.8%", "16", "203", "92.7%"], sortOrder: 9 },
];

const buildDynamicAnalysisRows = (): DynamicAnalysisSeedRow[] => {
  const overallOil = Array.from({ length: 5 }, (_, index) => ({
    kind: "overall-oil" as const,
    unit: "高采采油作业一区",
    block: `区块${index + 1}`,
    wellNo: null,
    endValues: [String(120 - index * 5), String(115 - index * 4), String(450 - index * 20), String(35 - index), `${92 + index * 0.3}%`],
    averageValues: [String(120 - index * 5), String(112 - index * 4), String(445 - index * 20), String(34 - index), `${91.8 + index * 0.2}%`],
    lastYearValues: [String(118 - index * 5), String(110 - index * 4), String(430 - index * 18), String(32 - index), `${91.5 + index * 0.2}%`],
    diffMonth: ["0", "+3", "+5", "+1", "0.2%"],
    diffYear: ["+2", "+5", "+20", "+3", "0.5%"],
    advice: [],
    status: null,
    process: null,
  }));
  const overallWater = Array.from({ length: 5 }, (_, index) => ({
    kind: "overall-water" as const,
    unit: "高采采油作业一区",
    block: `区块${index + 1}`,
    wellNo: null,
    endValues: [String(48 - index * 2), String(46 - index * 2), String(180 - index * 8)],
    averageValues: [String(48 - index * 2), String(45 - index * 2), String(176 - index * 8)],
    lastYearValues: [String(47 - index * 2), String(44 - index * 2), String(165 - index * 7)],
    diffMonth: ["0", "+1", "+4"],
    diffYear: ["+1", "+2", "+15"],
    advice: [],
    status: null,
    process: null,
  }));
  const singleOil = Array.from({ length: 30 }, (_, index) => ({
    kind: "single-oil" as const,
    unit: "高采采油作业一区",
    block: `区块${(index % 5) + 1}`,
    wellNo: `GS-${String(101 + index).padStart(3, "0")}`,
    endValues: [String(450 + index), String(35 + (index % 6)), `${(92 + (index % 5) * 0.2).toFixed(1)}%`],
    averageValues: [String(445 + index), String(34 + (index % 6)), `${(91.8 + (index % 5) * 0.2).toFixed(1)}%`],
    lastYearValues: [String(430 + index), String(32 + (index % 6)), `${(91.5 + (index % 5) * 0.2).toFixed(1)}%`],
    diffMonth: ["+5", "+1", "0.2%"],
    diffYear: ["+20", "+3", "0.5%"],
    advice: ["复核配注", "持续观察"],
    status: index % 5 === 1 ? "异常" : "正常",
    process: "分注",
  }));
  const singleWater = Array.from({ length: 35 }, (_, index) => ({
    kind: "single-water" as const,
    unit: "高采采油作业一区",
    block: `区块${(index % 5) + 1}`,
    wellNo: `GS-W${String(index + 1).padStart(2, "0")}`,
    endValues: [String(180 + index), (8.5 + (index % 5) * 0.1).toFixed(1), (12.1 + (index % 5) * 0.1).toFixed(1)],
    averageValues: [String(176 + index), (8.2 + (index % 5) * 0.1).toFixed(1), (11.8 + (index % 5) * 0.1).toFixed(1)],
    lastYearValues: [String(165 + index), (7.9 + (index % 5) * 0.1).toFixed(1), (11.5 + (index % 5) * 0.1).toFixed(1)],
    diffMonth: ["+4", "+0.3", "+0.3"],
    diffYear: ["+15", "+0.6", "+0.6"],
    advice: ["稳注", "正常"],
    status: index % 7 === 0 ? "维护" : "正常",
    process: "分注",
  }));
  return [...overallOil, ...overallWater, ...singleOil, ...singleWater];
};

export function buildSecondBatchSeedRows() {
  return {
    concentricTests: buildConcentricTests(),
    smartTests: buildSmartTests(),
    singleWellInjectionEvaluations: buildSingleWellInjectionEvaluations(),
    singleWellSealEvaluations: buildSingleWellSealEvaluations(),
    zonalIndicatorSummaries: buildZonalIndicatorSummaries(),
    dynamicAnalysisRows: buildDynamicAnalysisRows(),
  };
}
