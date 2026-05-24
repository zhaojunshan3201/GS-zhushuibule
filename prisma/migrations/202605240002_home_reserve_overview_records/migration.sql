CREATE TABLE "HomeReserveOverviewRecord" (
    "id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "oilArea" DOUBLE PRECISION NOT NULL,
    "producingReserve" DOUBLE PRECISION NOT NULL,
    "recoverableReserve" DOUBLE PRECISION NOT NULL,
    "recoveryRate" DOUBLE PRECISION NOT NULL,
    "lastYearOil" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeReserveOverviewRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomeReserveOverviewRecord_unit_block_key" ON "HomeReserveOverviewRecord"("unit", "block");
CREATE INDEX "HomeReserveOverviewRecord_unit_idx" ON "HomeReserveOverviewRecord"("unit");
CREATE INDEX "HomeReserveOverviewRecord_sortOrder_idx" ON "HomeReserveOverviewRecord"("sortOrder");
