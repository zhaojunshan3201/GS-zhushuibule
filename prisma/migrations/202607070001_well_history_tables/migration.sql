CREATE TABLE "WellHistoryPdf" (
  "id" TEXT NOT NULL,
  "wellNo" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "block" TEXT,
  "fileUrl" TEXT NOT NULL,
  "storedFileName" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "remark" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WellHistoryPdf_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WellHistoryArchive" (
  "id" TEXT NOT NULL,
  "wellNo" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "block" TEXT,
  "remark" TEXT,
  "currentPdfId" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WellHistoryArchive_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WellHistoryExtract" (
  "id" TEXT NOT NULL,
  "archiveId" TEXT NOT NULL,
  "pdfId" TEXT NOT NULL,
  "wellNo" TEXT NOT NULL,
  "title" TEXT,
  "summary" TEXT,
  "layersText" TEXT,
  "interpretationText" TEXT,
  "conclusionText" TEXT,
  "rawExtractText" TEXT,
  "extractStatus" TEXT NOT NULL DEFAULT 'pending',
  "extractSource" TEXT,
  "reviewStatus" TEXT NOT NULL DEFAULT 'unreviewed',
  "reviewRemark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WellHistoryExtract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WellHistoryPdfOverlay" (
  "id" TEXT NOT NULL,
  "wellNo" TEXT NOT NULL,
  "pdfId" TEXT NOT NULL,
  "elementsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WellHistoryPdfOverlay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WellHistoryPdf_wellNo_key" ON "WellHistoryPdf"("wellNo");
CREATE UNIQUE INDEX "WellHistoryArchive_wellNo_key" ON "WellHistoryArchive"("wellNo");
CREATE UNIQUE INDEX "WellHistoryArchive_currentPdfId_key" ON "WellHistoryArchive"("currentPdfId");
CREATE UNIQUE INDEX "WellHistoryExtract_archiveId_key" ON "WellHistoryExtract"("archiveId");
CREATE UNIQUE INDEX "WellHistoryExtract_pdfId_key" ON "WellHistoryExtract"("pdfId");
CREATE UNIQUE INDEX "WellHistoryPdfOverlay_wellNo_pdfId_key" ON "WellHistoryPdfOverlay"("wellNo", "pdfId");

CREATE INDEX "WellHistoryArchive_unit_idx" ON "WellHistoryArchive"("unit");
CREATE INDEX "WellHistoryArchive_block_idx" ON "WellHistoryArchive"("block");
CREATE INDEX "WellHistoryArchive_displayName_idx" ON "WellHistoryArchive"("displayName");
CREATE INDEX "WellHistoryExtract_wellNo_idx" ON "WellHistoryExtract"("wellNo");
CREATE INDEX "WellHistoryExtract_extractStatus_idx" ON "WellHistoryExtract"("extractStatus");
CREATE INDEX "WellHistoryExtract_reviewStatus_idx" ON "WellHistoryExtract"("reviewStatus");

ALTER TABLE "WellHistoryArchive"
  ADD CONSTRAINT "WellHistoryArchive_currentPdfId_fkey"
  FOREIGN KEY ("currentPdfId") REFERENCES "WellHistoryPdf"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WellHistoryExtract"
  ADD CONSTRAINT "WellHistoryExtract_archiveId_fkey"
  FOREIGN KEY ("archiveId") REFERENCES "WellHistoryArchive"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WellHistoryExtract"
  ADD CONSTRAINT "WellHistoryExtract_pdfId_fkey"
  FOREIGN KEY ("pdfId") REFERENCES "WellHistoryPdf"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
