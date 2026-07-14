CREATE TABLE "WellHistoryRichTextDocument" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "wellNo" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL DEFAULT 1,
    "savedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WellHistoryRichTextDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WellHistoryRichTextVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "wellNo" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "savedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WellHistoryRichTextVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WellHistoryRichTextDocument_archiveId_key" ON "WellHistoryRichTextDocument"("archiveId");
CREATE UNIQUE INDEX "WellHistoryRichTextDocument_wellNo_key" ON "WellHistoryRichTextDocument"("wellNo");
CREATE UNIQUE INDEX "WellHistoryRichTextVersion_documentId_versionNo_key" ON "WellHistoryRichTextVersion"("documentId", "versionNo");
CREATE INDEX "WellHistoryRichTextVersion_archiveId_versionNo_idx" ON "WellHistoryRichTextVersion"("archiveId", "versionNo");
CREATE INDEX "WellHistoryRichTextVersion_wellNo_idx" ON "WellHistoryRichTextVersion"("wellNo");

ALTER TABLE "WellHistoryRichTextDocument" ADD CONSTRAINT "WellHistoryRichTextDocument_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "WellHistoryArchive"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WellHistoryRichTextVersion" ADD CONSTRAINT "WellHistoryRichTextVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "WellHistoryRichTextDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WellHistoryRichTextVersion" ADD CONSTRAINT "WellHistoryRichTextVersion_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "WellHistoryArchive"("id") ON DELETE CASCADE ON UPDATE CASCADE;
