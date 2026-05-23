ALTER TABLE "WaterCutRecord" ADD COLUMN "unit" TEXT;
ALTER TABLE "WaterCutRecord" ADD COLUMN "block" TEXT;
ALTER TABLE "WaterCutRecord" ADD COLUMN "wellNo" TEXT;
ALTER TABLE "WaterCutRecord" ADD COLUMN "sampleDate" DATE;
ALTER TABLE "WaterCutRecord" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "WaterCutRecord" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "WaterCutRecord" AS water_cut
SET
  "unit" = COALESCE(well."unit", ''),
  "block" = COALESCE(well."block", ''),
  "wellNo" = COALESCE(well."id", water_cut."wellId"),
  "sampleDate" = CASE
    WHEN water_cut."date" ~ '^\d{4}-\d{2}-\d{2}$' THEN water_cut."date"::date
    ELSE CURRENT_DATE
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Well" AS well
WHERE water_cut."wellId" = well."id";

UPDATE "WaterCutRecord"
SET
  "unit" = COALESCE("unit", ''),
  "block" = COALESCE("block", ''),
  "wellNo" = COALESCE("wellNo", "wellId"),
  "sampleDate" = COALESCE("sampleDate", CURRENT_DATE),
  "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

ALTER TABLE "WaterCutRecord" ALTER COLUMN "unit" SET NOT NULL;
ALTER TABLE "WaterCutRecord" ALTER COLUMN "block" SET NOT NULL;
ALTER TABLE "WaterCutRecord" ALTER COLUMN "wellNo" SET NOT NULL;
ALTER TABLE "WaterCutRecord" ALTER COLUMN "sampleDate" SET NOT NULL;
ALTER TABLE "WaterCutRecord" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "WaterCutRecord" DROP CONSTRAINT IF EXISTS "WaterCutRecord_wellId_fkey";
DROP INDEX IF EXISTS "WaterCutRecord_wellId_idx";
ALTER TABLE "WaterCutRecord" DROP COLUMN "wellId";
ALTER TABLE "WaterCutRecord" DROP COLUMN "date";

CREATE INDEX "WaterCutRecord_unit_idx" ON "WaterCutRecord"("unit");
CREATE INDEX "WaterCutRecord_block_idx" ON "WaterCutRecord"("block");
CREATE INDEX "WaterCutRecord_wellNo_idx" ON "WaterCutRecord"("wellNo");
CREATE INDEX "WaterCutRecord_sampleDate_idx" ON "WaterCutRecord"("sampleDate");
CREATE INDEX "WaterCutRecord_waterCut_idx" ON "WaterCutRecord"("waterCut");

CREATE TABLE "InjectionTechRecord" (
  "id" TEXT NOT NULL,
  "wellNo" TEXT NOT NULL,
  "block" TEXT NOT NULL,
  "workArea" TEXT NOT NULL,
  "process" TEXT NOT NULL,
  "packerCount" INTEGER NOT NULL,
  "packerModels" JSONB NOT NULL,
  "bottomStructure" TEXT NOT NULL,
  "washable" TEXT NOT NULL,
  "doublePacker" TEXT NOT NULL,
  "washReminder" TEXT,
  "lastWorkDate" DATE NOT NULL,
  "runningDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InjectionTechRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InjectionTechRecord_wellNo_idx" ON "InjectionTechRecord"("wellNo");
CREATE INDEX "InjectionTechRecord_block_idx" ON "InjectionTechRecord"("block");
CREATE INDEX "InjectionTechRecord_workArea_idx" ON "InjectionTechRecord"("workArea");
CREATE INDEX "InjectionTechRecord_process_idx" ON "InjectionTechRecord"("process");
CREATE INDEX "InjectionTechRecord_packerCount_idx" ON "InjectionTechRecord"("packerCount");
CREATE INDEX "InjectionTechRecord_bottomStructure_idx" ON "InjectionTechRecord"("bottomStructure");

CREATE TABLE "WellFlushingRecord" (
  "id" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "wellNo" TEXT NOT NULL,
  "washDate" DATE NOT NULL,
  "daysSinceLastWash" INTEGER NOT NULL,
  "method" TEXT NOT NULL,
  "equipmentPressure" DOUBLE PRECISION,
  "duration" DOUBLE PRECISION,
  "totalWater" DOUBLE PRECISION,
  "firstLevel" JSONB NOT NULL,
  "secondLevel" JSONB NOT NULL,
  "suspendedMatter" JSONB NOT NULL,
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WellFlushingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WellFlushingRecord_unit_idx" ON "WellFlushingRecord"("unit");
CREATE INDEX "WellFlushingRecord_wellNo_idx" ON "WellFlushingRecord"("wellNo");
CREATE INDEX "WellFlushingRecord_washDate_idx" ON "WellFlushingRecord"("washDate");

CREATE TABLE "AbnormalWellRecord" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "wellNo" TEXT NOT NULL,
  "block" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "process" TEXT NOT NULL,
  "normalDaily" TEXT,
  "normalOilPressure" TEXT,
  "normalCasingPressure" TEXT,
  "normalLayerPressure" TEXT,
  "abnormalDaily" TEXT,
  "abnormalOilPressure" TEXT,
  "abnormalCasingPressure" TEXT,
  "abnormalLayerPressure" TEXT,
  "suggestion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AbnormalWellRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AbnormalWellRecord_category_idx" ON "AbnormalWellRecord"("category");
CREATE INDEX "AbnormalWellRecord_wellNo_idx" ON "AbnormalWellRecord"("wellNo");
CREATE INDEX "AbnormalWellRecord_block_idx" ON "AbnormalWellRecord"("block");
CREATE INDEX "AbnormalWellRecord_unit_idx" ON "AbnormalWellRecord"("unit");
CREATE INDEX "AbnormalWellRecord_process_idx" ON "AbnormalWellRecord"("process");
