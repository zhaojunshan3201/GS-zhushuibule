CREATE TABLE "ConcentricTestRecord" (
    "id" TEXT NOT NULL,
    "wellNo" TEXT NOT NULL,
    "testDate" DATE NOT NULL,
    "allocatorCount" INTEGER NOT NULL,
    "freedom" TEXT,
    "partialStroke" TEXT,
    "fullyStuck" TEXT,
    "layerFreedom" JSONB NOT NULL,
    "dailyInjection" JSONB NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConcentricTestRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartTestRecord" (
    "id" TEXT NOT NULL,
    "wellNo" TEXT NOT NULL,
    "testDate" DATE NOT NULL,
    "allocatorCount" INTEGER NOT NULL,
    "dailyAllocation" JSONB NOT NULL,
    "dailyInjection" JSONB NOT NULL,
    "allocationDiff" JSONB NOT NULL,
    "nozzleOpening" JSONB NOT NULL,
    "wellheadPressure" TEXT NOT NULL,
    "innerPressure" JSONB NOT NULL,
    "outerPressure" JSONB NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartTestRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SingleWellInjectionEvaluationRecord" (
    "id" TEXT NOT NULL,
    "wellNo" TEXT NOT NULL,
    "process" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "evaluationDate" DATE NOT NULL,
    "intervalCount" INTEGER NOT NULL,
    "actualCount" INTEGER NOT NULL,
    "qualifiedCount" INTEGER NOT NULL,
    "unqualified" JSONB NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SingleWellInjectionEvaluationRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SingleWellSealEvaluationRecord" (
    "id" TEXT NOT NULL,
    "wellNo" TEXT NOT NULL,
    "process" TEXT NOT NULL,
    "evaluationDate" DATE NOT NULL,
    "intervalCount" INTEGER NOT NULL,
    "actualCount" INTEGER NOT NULL,
    "needSealCount" INTEGER NOT NULL,
    "qualifiedSealCount" INTEGER NOT NULL,
    "sealStats" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SingleWellSealEvaluationRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ZonalIndicatorSummaryRecord" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "process" TEXT NOT NULL,
    "wellCount" INTEGER NOT NULL,
    "processRate" TEXT NOT NULL,
    "intervalCount" INTEGER NOT NULL,
    "actualCount" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "segmentSeal" JSONB NOT NULL,
    "fullSeal" JSONB NOT NULL,
    "allocation" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZonalIndicatorSummaryRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DynamicAnalysisRecord" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "wellNo" TEXT,
    "endValues" JSONB NOT NULL,
    "averageValues" JSONB NOT NULL,
    "lastYearValues" JSONB NOT NULL,
    "diffMonth" JSONB NOT NULL,
    "diffYear" JSONB NOT NULL,
    "advice" JSONB NOT NULL,
    "status" TEXT,
    "process" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DynamicAnalysisRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConcentricTestRecord_wellNo_idx" ON "ConcentricTestRecord"("wellNo");
CREATE INDEX "ConcentricTestRecord_testDate_idx" ON "ConcentricTestRecord"("testDate");
CREATE INDEX "SmartTestRecord_wellNo_idx" ON "SmartTestRecord"("wellNo");
CREATE INDEX "SmartTestRecord_testDate_idx" ON "SmartTestRecord"("testDate");
CREATE INDEX "SingleWellInjectionEvaluationRecord_wellNo_idx" ON "SingleWellInjectionEvaluationRecord"("wellNo");
CREATE INDEX "SingleWellInjectionEvaluationRecord_process_idx" ON "SingleWellInjectionEvaluationRecord"("process");
CREATE INDEX "SingleWellInjectionEvaluationRecord_unit_idx" ON "SingleWellInjectionEvaluationRecord"("unit");
CREATE INDEX "SingleWellInjectionEvaluationRecord_evaluationDate_idx" ON "SingleWellInjectionEvaluationRecord"("evaluationDate");
CREATE INDEX "SingleWellSealEvaluationRecord_wellNo_idx" ON "SingleWellSealEvaluationRecord"("wellNo");
CREATE INDEX "SingleWellSealEvaluationRecord_process_idx" ON "SingleWellSealEvaluationRecord"("process");
CREATE INDEX "SingleWellSealEvaluationRecord_evaluationDate_idx" ON "SingleWellSealEvaluationRecord"("evaluationDate");
CREATE INDEX "ZonalIndicatorSummaryRecord_category_idx" ON "ZonalIndicatorSummaryRecord"("category");
CREATE INDEX "ZonalIndicatorSummaryRecord_process_idx" ON "ZonalIndicatorSummaryRecord"("process");
CREATE INDEX "ZonalIndicatorSummaryRecord_sortOrder_idx" ON "ZonalIndicatorSummaryRecord"("sortOrder");
CREATE INDEX "DynamicAnalysisRecord_kind_idx" ON "DynamicAnalysisRecord"("kind");
CREATE INDEX "DynamicAnalysisRecord_unit_idx" ON "DynamicAnalysisRecord"("unit");
CREATE INDEX "DynamicAnalysisRecord_block_idx" ON "DynamicAnalysisRecord"("block");
CREATE INDEX "DynamicAnalysisRecord_wellNo_idx" ON "DynamicAnalysisRecord"("wellNo");
