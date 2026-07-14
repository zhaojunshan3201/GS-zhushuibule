CREATE TABLE "WellHistoryPptx" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "wellNo" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "sourceFormat" TEXT NOT NULL,
    "editorModelJson" JSONB NOT NULL,
    "versionNo" INTEGER NOT NULL DEFAULT 1,
    "savedBy" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WellHistoryPptx_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WellHistoryPptxVersion" (
    "id" TEXT NOT NULL,
    "pptxId" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "wellNo" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "sourceFormat" TEXT NOT NULL,
    "editorModelJson" JSONB NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "savedBy" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WellHistoryPptxVersion_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "WellHistoryArchive" ADD COLUMN "currentPptxId" TEXT;
CREATE UNIQUE INDEX "WellHistoryArchive_currentPptxId_key" ON "WellHistoryArchive"("currentPptxId");
CREATE UNIQUE INDEX "WellHistoryPptx_archiveId_key" ON "WellHistoryPptx"("archiveId");
CREATE UNIQUE INDEX "WellHistoryPptx_wellNo_key" ON "WellHistoryPptx"("wellNo");
CREATE INDEX "WellHistoryPptx_archiveId_idx" ON "WellHistoryPptx"("archiveId");
CREATE INDEX "WellHistoryPptx_wellNo_idx" ON "WellHistoryPptx"("wellNo");
CREATE UNIQUE INDEX "WellHistoryPptxVersion_pptxId_versionNo_key" ON "WellHistoryPptxVersion"("pptxId", "versionNo");
CREATE INDEX "WellHistoryPptxVersion_archiveId_versionNo_idx" ON "WellHistoryPptxVersion"("archiveId", "versionNo");
CREATE INDEX "WellHistoryPptxVersion_wellNo_idx" ON "WellHistoryPptxVersion"("wellNo");
ALTER TABLE "WellHistoryPptx" ADD CONSTRAINT "WellHistoryPptx_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "WellHistoryArchive"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WellHistoryPptxVersion" ADD CONSTRAINT "WellHistoryPptxVersion_pptxId_fkey" FOREIGN KEY ("pptxId") REFERENCES "WellHistoryPptx"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WellHistoryPptxVersion" ADD CONSTRAINT "WellHistoryPptxVersion_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "WellHistoryArchive"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WellHistoryArchive" ADD CONSTRAINT "WellHistoryArchive_currentPptxId_fkey" FOREIGN KEY ("currentPptxId") REFERENCES "WellHistoryPptx"("id") ON DELETE SET NULL ON UPDATE CASCADE;
