CREATE TABLE "IndicatorCurveRecord" (
    "id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "wellNo" TEXT NOT NULL,
    "testDate" DATE NOT NULL,
    "testInterval" TEXT NOT NULL,
    "injection1" DOUBLE PRECISION NOT NULL,
    "pressure1" DOUBLE PRECISION NOT NULL,
    "injection2" DOUBLE PRECISION NOT NULL,
    "pressure2" DOUBLE PRECISION NOT NULL,
    "injection3" DOUBLE PRECISION NOT NULL,
    "pressure3" DOUBLE PRECISION NOT NULL,
    "injection4" DOUBLE PRECISION NOT NULL,
    "pressure4" DOUBLE PRECISION NOT NULL,
    "injection5" DOUBLE PRECISION NOT NULL,
    "pressure5" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorCurveRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IndicatorCurveRecord_unit_idx" ON "IndicatorCurveRecord"("unit");
CREATE INDEX "IndicatorCurveRecord_block_idx" ON "IndicatorCurveRecord"("block");
CREATE INDEX "IndicatorCurveRecord_wellNo_idx" ON "IndicatorCurveRecord"("wellNo");
CREATE INDEX "IndicatorCurveRecord_testDate_idx" ON "IndicatorCurveRecord"("testDate");
CREATE UNIQUE INDEX "IndicatorCurveRecord_wellNo_testDate_testInterval_key" ON "IndicatorCurveRecord"("wellNo", "testDate", "testInterval");
