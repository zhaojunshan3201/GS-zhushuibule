export const DYNAMIC_ADJUSTMENT_PURPOSES = ["解决污水平衡", "油井产状变化"] as const;

export type DynamicAdjustmentPurpose = (typeof DYNAMIC_ADJUSTMENT_PURPOSES)[number];

export type DynamicAdjustmentNumericFields = {
  beforeDailyLiquid?: number | null;
  beforeDailyOil?: number | null;
  beforeWaterCut?: number | null;
  afterDailyLiquid?: number | null;
  afterDailyOil?: number | null;
  afterWaterCut?: number | null;
};

export type DynamicAdjustmentDiffs = {
  diffDailyLiquid: number | null;
  diffDailyOil: number | null;
  diffWaterCut: number | null;
};

export type DynamicAdjustmentForm = {
  adjustmentWaterWell: string;
  injectionProcess: string;
  adjustmentDate: string;
  beforeDailyInjection: string;
  afterDailyInjection: string;
  adjustmentPurpose: DynamicAdjustmentPurpose;
  trackedOilWell: string;
  beforeDailyLiquid: string;
  beforeDailyOil: string;
  beforeWaterCut: string;
  afterDailyLiquid: string;
  afterDailyOil: string;
  afterWaterCut: string;
  stageDays: string;
  cumulativeOil: string;
  remark: string;
};

export type DynamicAdjustmentPayloadInput = Record<string, unknown>;

export type NormalizedDynamicAdjustmentPayload = {
  adjustmentWaterWell: string;
  injectionProcess: string | null;
  adjustmentDate: string;
  beforeDailyInjection: number | null;
  afterDailyInjection: number | null;
  adjustmentPurpose: string;
  trackedOilWell: string;
  beforeDailyLiquid: number | null;
  beforeDailyOil: number | null;
  beforeWaterCut: number | null;
  afterDailyLiquid: number | null;
  afterDailyOil: number | null;
  afterWaterCut: number | null;
  diffDailyLiquid: number | null;
  diffDailyOil: number | null;
  diffWaterCut: number | null;
  stageDays: number | null;
  cumulativeOil: number | null;
  remark: string | null;
};

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toTrimmedString = (value: unknown) => String(value ?? "").trim();

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateSingleDiff = (beforeValue?: number | null, afterValue?: number | null) => {
  if (beforeValue === null || beforeValue === undefined) return null;
  if (afterValue === null || afterValue === undefined) return null;
  return roundToTwo(afterValue - beforeValue);
};

export function calculateDynamicAdjustmentDiffs(values: DynamicAdjustmentNumericFields): DynamicAdjustmentDiffs {
  return {
    diffDailyLiquid: calculateSingleDiff(values.beforeDailyLiquid, values.afterDailyLiquid),
    diffDailyOil: calculateSingleDiff(values.beforeDailyOil, values.afterDailyOil),
    diffWaterCut: calculateSingleDiff(values.beforeWaterCut, values.afterWaterCut),
  };
}

export function createEmptyDynamicAdjustmentForm(): DynamicAdjustmentForm {
  return {
    adjustmentWaterWell: "",
    injectionProcess: "",
    adjustmentDate: new Date().toISOString().slice(0, 10),
    beforeDailyInjection: "",
    afterDailyInjection: "",
    adjustmentPurpose: DYNAMIC_ADJUSTMENT_PURPOSES[0],
    trackedOilWell: "",
    beforeDailyLiquid: "",
    beforeDailyOil: "",
    beforeWaterCut: "",
    afterDailyLiquid: "",
    afterDailyOil: "",
    afterWaterCut: "",
    stageDays: "",
    cumulativeOil: "",
    remark: "",
  };
}

export function normalizeDynamicAdjustmentPayload(input: DynamicAdjustmentPayloadInput): NormalizedDynamicAdjustmentPayload {
  const beforeDailyLiquid = toNullableNumber(input.beforeDailyLiquid);
  const beforeDailyOil = toNullableNumber(input.beforeDailyOil);
  const beforeWaterCut = toNullableNumber(input.beforeWaterCut);
  const afterDailyLiquid = toNullableNumber(input.afterDailyLiquid);
  const afterDailyOil = toNullableNumber(input.afterDailyOil);
  const afterWaterCut = toNullableNumber(input.afterWaterCut);
  const diffs = calculateDynamicAdjustmentDiffs({
    beforeDailyLiquid,
    beforeDailyOil,
    beforeWaterCut,
    afterDailyLiquid,
    afterDailyOil,
    afterWaterCut,
  });
  const injectionProcess = toTrimmedString(input.injectionProcess);
  const remark = toTrimmedString(input.remark);

  return {
    adjustmentWaterWell: toTrimmedString(input.adjustmentWaterWell),
    injectionProcess: injectionProcess || null,
    adjustmentDate: toTrimmedString(input.adjustmentDate),
    beforeDailyInjection: toNullableNumber(input.beforeDailyInjection),
    afterDailyInjection: toNullableNumber(input.afterDailyInjection),
    adjustmentPurpose: toTrimmedString(input.adjustmentPurpose),
    trackedOilWell: toTrimmedString(input.trackedOilWell),
    beforeDailyLiquid,
    beforeDailyOil,
    beforeWaterCut,
    afterDailyLiquid,
    afterDailyOil,
    afterWaterCut,
    ...diffs,
    stageDays: toNullableNumber(input.stageDays),
    cumulativeOil: toNullableNumber(input.cumulativeOil),
    remark: remark || null,
  };
}
