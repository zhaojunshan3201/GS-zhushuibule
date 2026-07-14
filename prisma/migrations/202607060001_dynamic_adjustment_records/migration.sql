CREATE TABLE "DynamicAdjustmentRecord" (
  "id" TEXT NOT NULL,
  "adjustmentWaterWell" TEXT NOT NULL,
  "injectionProcess" TEXT,
  "adjustmentDate" DATE NOT NULL,
  "beforeDailyInjection" DOUBLE PRECISION,
  "afterDailyInjection" DOUBLE PRECISION,
  "adjustmentPurpose" TEXT NOT NULL,
  "trackedOilWell" TEXT NOT NULL,
  "beforeDailyLiquid" DOUBLE PRECISION,
  "beforeDailyOil" DOUBLE PRECISION,
  "beforeWaterCut" DOUBLE PRECISION,
  "afterDailyLiquid" DOUBLE PRECISION,
  "afterDailyOil" DOUBLE PRECISION,
  "afterWaterCut" DOUBLE PRECISION,
  "diffDailyLiquid" DOUBLE PRECISION,
  "diffDailyOil" DOUBLE PRECISION,
  "diffWaterCut" DOUBLE PRECISION,
  "stageDays" INTEGER,
  "cumulativeOil" DOUBLE PRECISION,
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DynamicAdjustmentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DynamicAdjustmentRecord_adjustmentDate_idx" ON "DynamicAdjustmentRecord"("adjustmentDate");
CREATE INDEX "DynamicAdjustmentRecord_adjustmentWaterWell_idx" ON "DynamicAdjustmentRecord"("adjustmentWaterWell");
CREATE INDEX "DynamicAdjustmentRecord_trackedOilWell_idx" ON "DynamicAdjustmentRecord"("trackedOilWell");
CREATE INDEX "DynamicAdjustmentRecord_adjustmentPurpose_idx" ON "DynamicAdjustmentRecord"("adjustmentPurpose");
