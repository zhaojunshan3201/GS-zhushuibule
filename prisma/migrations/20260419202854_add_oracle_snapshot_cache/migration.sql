-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "deadline" TEXT,
    "fromUnit" TEXT NOT NULL,
    "toUnit" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "replies" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "location" TEXT,
    "organizer" TEXT NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Well" (
    "id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "block" TEXT,
    "status" TEXT NOT NULL,
    "pressure" DOUBLE PRECISION NOT NULL,
    "injectionRate" DOUBLE PRECISION NOT NULL,
    "lastUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Well_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterCutRecord" (
    "id" TEXT NOT NULL,
    "wellId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "waterCut" DOUBLE PRECISION NOT NULL,
    "tester" TEXT NOT NULL,
    "remark" TEXT,

    CONSTRAINT "WaterCutRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellMeasure" (
    "id" TEXT NOT NULL,
    "wellId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" TEXT,

    CONSTRAINT "WellMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentRecord" (
    "id" TEXT NOT NULL,
    "wellId" TEXT NOT NULL,
    "currentRate" DOUBLE PRECISION NOT NULL,
    "suggestedRate" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdjustmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressureData" (
    "id" TEXT NOT NULL,
    "wellId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "pressure" DOUBLE PRECISION NOT NULL,
    "flowRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PressureData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "empId" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL DEFAULT '123456',
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "phone" TEXT,
    "gender" TEXT DEFAULT '男',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "time" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "ip" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeptResponsibility" (
    "unit" TEXT NOT NULL,
    "responsibility" TEXT NOT NULL,

    CONSTRAINT "DeptResponsibility_pkey" PRIMARY KEY ("unit")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "OracleRefreshBatch" (
    "id" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "trigger" TEXT NOT NULL DEFAULT 'startup',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OracleRefreshBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionWellSnapshot" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "oracleScope" TEXT NOT NULL,
    "jh" TEXT NOT NULL,
    "rq" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "liquid" DOUBLE PRECISION NOT NULL,
    "oil" DOUBLE PRECISION NOT NULL,
    "diluent" DOUBLE PRECISION NOT NULL,
    "waterCut" DOUBLE PRECISION NOT NULL,
    "gas" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionWellSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterBlockDailySnapshot" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "oracleScope" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "rq" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "open" INTEGER NOT NULL,
    "injection" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaterBlockDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_empId_key" ON "User"("empId");

-- CreateIndex
CREATE INDEX "OracleRefreshBatch_dataset_isActive_idx" ON "OracleRefreshBatch"("dataset", "isActive");

-- CreateIndex
CREATE INDEX "OracleRefreshBatch_dataset_status_idx" ON "OracleRefreshBatch"("dataset", "status");

-- CreateIndex
CREATE INDEX "OracleRefreshBatch_startedAt_idx" ON "OracleRefreshBatch"("startedAt");

-- CreateIndex
CREATE INDEX "ProductionWellSnapshot_batchId_idx" ON "ProductionWellSnapshot"("batchId");

-- CreateIndex
CREATE INDEX "ProductionWellSnapshot_unit_rq_idx" ON "ProductionWellSnapshot"("unit", "rq");

-- CreateIndex
CREATE INDEX "ProductionWellSnapshot_unit_block_idx" ON "ProductionWellSnapshot"("unit", "block");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionWellSnapshot_batchId_unit_rank_key" ON "ProductionWellSnapshot"("batchId", "unit", "rank");

-- CreateIndex
CREATE INDEX "WaterBlockDailySnapshot_batchId_idx" ON "WaterBlockDailySnapshot"("batchId");

-- CreateIndex
CREATE INDEX "WaterBlockDailySnapshot_unit_rq_idx" ON "WaterBlockDailySnapshot"("unit", "rq");

-- CreateIndex
CREATE INDEX "WaterBlockDailySnapshot_unit_block_idx" ON "WaterBlockDailySnapshot"("unit", "block");

-- CreateIndex
CREATE UNIQUE INDEX "WaterBlockDailySnapshot_batchId_unit_block_rq_key" ON "WaterBlockDailySnapshot"("batchId", "unit", "block", "rq");

-- AddForeignKey
ALTER TABLE "WaterCutRecord" ADD CONSTRAINT "WaterCutRecord_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "Well"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellMeasure" ADD CONSTRAINT "WellMeasure_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "Well"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionWellSnapshot" ADD CONSTRAINT "ProductionWellSnapshot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OracleRefreshBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterBlockDailySnapshot" ADD CONSTRAINT "WaterBlockDailySnapshot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OracleRefreshBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
