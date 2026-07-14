ALTER TABLE "WellFlushingRecord" ADD COLUMN IF NOT EXISTS "block" TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "WellFlushingRecord_block_idx" ON "WellFlushingRecord"("block");
