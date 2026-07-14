ALTER TABLE "ConcentricTestRecord" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT '高采采油作业一区';
ALTER TABLE "ConcentricTestRecord" ADD COLUMN IF NOT EXISTS "block" TEXT NOT NULL DEFAULT '雷11';
CREATE INDEX IF NOT EXISTS "ConcentricTestRecord_unit_idx" ON "ConcentricTestRecord"("unit");
CREATE INDEX IF NOT EXISTS "ConcentricTestRecord_block_idx" ON "ConcentricTestRecord"("block");

ALTER TABLE "SmartTestRecord" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT '高采采油作业一区';
ALTER TABLE "SmartTestRecord" ADD COLUMN IF NOT EXISTS "block" TEXT NOT NULL DEFAULT '雷11';
CREATE INDEX IF NOT EXISTS "SmartTestRecord_unit_idx" ON "SmartTestRecord"("unit");
CREATE INDEX IF NOT EXISTS "SmartTestRecord_block_idx" ON "SmartTestRecord"("block");

ALTER TABLE "SingleWellInjectionEvaluationRecord" ADD COLUMN IF NOT EXISTS "block" TEXT NOT NULL DEFAULT '雷11';
CREATE INDEX IF NOT EXISTS "SingleWellInjectionEvaluationRecord_block_idx" ON "SingleWellInjectionEvaluationRecord"("block");

ALTER TABLE "SingleWellSealEvaluationRecord" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT '高采采油作业一区';
ALTER TABLE "SingleWellSealEvaluationRecord" ADD COLUMN IF NOT EXISTS "block" TEXT NOT NULL DEFAULT '雷11';
CREATE INDEX IF NOT EXISTS "SingleWellSealEvaluationRecord_unit_idx" ON "SingleWellSealEvaluationRecord"("unit");
CREATE INDEX IF NOT EXISTS "SingleWellSealEvaluationRecord_block_idx" ON "SingleWellSealEvaluationRecord"("block");
