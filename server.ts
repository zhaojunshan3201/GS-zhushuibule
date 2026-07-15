import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { promises as fs } from "fs";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import oracledb from "oracledb";
import { PDFDocument } from "pdf-lib";
import { parsePptxWellHistory, writePptxWellHistory, type PptxWellHistoryDocument } from "./src/shared/pptxWellHistory";
import { buildPptSlideHtml, sanitizeWellHistoryHtml } from "./src/shared/wellHistoryRichText";
import dotenv from "dotenv";
import { promisify } from "util";
import { z } from "zod";
import {
  DYNAMIC_ADJUSTMENT_PURPOSES,
  normalizeDynamicAdjustmentPayload,
} from "./src/shared/dynamicAdjustment";
import {
  buildAbnormalWellWhere,
  buildCoreTableSeedRows,
  buildDateRange,
  buildWaterCutWhere,
  normalizeAbnormalWellPayload,
  normalizePagination,
  normalizeWellFlushingPayload,
  normalizeWaterCutPayload,
  toNullableText,
  toNumberOrNull,
} from "./src/shared/coreTableRecords";
import {
  buildConcentricTestWhere,
  buildDynamicAnalysisWhere,
  buildSecondBatchSeedRows,
  buildSingleWellEvaluationWhere,
  buildZonalIndicatorSummaryWhere,
  filterDynamicAnalysisRowsByDiffThresholds,
  normalizeConcentricTestPayload,
  normalizeSingleWellInjectionEvaluationPayload,
  normalizeSingleWellSealEvaluationPayload,
  normalizeSmartTestPayload,
} from "./src/shared/secondBatchRecords";
import {
  buildHomeReserveOverviewRows,
  buildHomeReserveOverviewSeedRows,
} from "./src/shared/homeReserveOverview";
import {
  getWellHistoryRenameHint,
  normalizeWellHistoryWellNo,
  parseWellHistoryImportFileName,
  selectLatestWellHistoryImports,
  sortWellHistoryImportParts,
} from "./src/shared/wellHistoryImport";

dotenv.config();

if (process.env.ORACLE_LIB_DIR) {
  try {
    oracledb.initOracleClient({ libDir: process.env.ORACLE_LIB_DIR });
  } catch (error) {
    console.error("Failed to initialize Oracle Thick Mode:", error);
  }
}

const prisma = new PrismaClient();
const snapshotPrisma = prisma as PrismaClient & {
  oracleRefreshBatch?: any;
  productionWellSnapshot?: any;
  waterBlockDailySnapshot?: any;
  oracleImportRun?: any;
  productionWellHistory?: any;
  waterWellHistory?: any;
  wellHistoryPdf?: any;
  wellHistoryArchive?: any;
  wellHistoryExtract?: any;
  wellHistoryPdfOverlay?: any;
  wellHistoryPptx?: any;
  wellHistoryPptxVersion?: any;
  dynamicAdjustmentRecord?: any;
  homeReserveOverviewRecord?: any;
};
const app = express();
const PORT = 5000;
const execFileAsync = promisify(execFile);
const PRODUCTION_UNITS = ["采油作业一区", "采油作业二区", "采油作业三区"] as const;
const PRODUCTION_SNAPSHOT_DATASET = "production_wells";
const WATER_SNAPSHOT_DATASET = "water_block_daily";
const PRODUCTION_HISTORY_DATASET = "production_history";
const WATER_HISTORY_DATASET = "water_history";
const WATER_SNAPSHOT_START_DATE = process.env.WATER_SNAPSHOT_START_DATE ?? "20260101";
const HISTORY_BACKFILL_START_DATE = process.env.ORACLE_HISTORY_START_DATE ?? "20230101";
const DEFAULT_ORACLE_FACTORY_NAME = process.env.ORACLE_FACTORY_NAME ?? "%高升采油厂%";
const HISTORY_INSERT_BATCH_SIZE = 500;
const ORACLE_REFRESH_INTERVAL_MS = Number(process.env.ORACLE_REFRESH_INTERVAL_MS ?? 10 * 60 * 1000);
const SNAPSHOT_SOURCE = "postgresql-cache";
const HISTORY_SOURCE = "postgresql-history";
const LIVE_SOURCE = "oracle-live";
const DEFAULT_ADMIN = {
  name: "管理员",
  empId: "GS001",
  password: "admin666",
  role: "ADMIN",
  unit: "采油管理部",
  status: "Active",
  email: "",
} as const;
const DEFAULT_SYSTEM_CONFIGS = [
  { key: "systemName", value: "注水管理平台" },
  { key: "systemLogo", value: "" },
  { key: "loginLogo", value: "" },
  { key: "sidebarLogo", value: "" },
  { key: "loginBg", value: "https://picsum.photos/seed/oilfield/1920/1080" },
  { key: "welcomeBg1", value: "https://picsum.photos/seed/oilfield_water1/1200/600" },
  { key: "welcomeBg2", value: "https://picsum.photos/seed/oilfield_water2/1200/600" },
  { key: "welcomeBg3", value: "https://picsum.photos/seed/oilfield_water3/1200/600" },
  { key: "welcomeTitle1", value: "注水管理平台正式上线运行" },
  { key: "welcomeTitle2", value: "实时掌握注水动态与井站状态" },
  { key: "welcomeTitle3", value: "异常预警与任务协同闭环管理" },
  { key: "welcomeDesc1", value: "本系统旨在通过数字化手段提升注水开发管理水平，实现数据实时监控、异常智能预警及任务高效协同。" },
  { key: "welcomeDesc2", value: "聚合作业区、研究所与管理部门数据，支撑欢迎页快速总览重点信息与生产态势。" },
  { key: "welcomeDesc3", value: "围绕异常井、督办任务和重点事项，推动问题发现、处理反馈到审核闭环的一体化协作。" },
] as const;
const parseStrictDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const toDate = (value: string) => {
  const date = parseStrictDate(value);
  if (!date) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
};
const paginatedResponse = (rows: unknown[], total: number, page: number, pageSize: number) => ({
  rows,
  total,
  page,
  pageSize,
});
const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const SYSTEM_UPLOAD_DIR = path.join(UPLOAD_ROOT, "system");
const WELL_HISTORY_UPLOAD_DIR = path.join(UPLOAD_ROOT, "well-history");
const WELL_HISTORY_SOURCE_UPLOAD_DIR = path.join(UPLOAD_ROOT, "well-history-source");
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_WELL_HISTORY_PDF_BYTES = 50 * 1024 * 1024;
const MAX_WELL_HISTORY_PPTX_FILES = 20;
const MAX_WELL_HISTORY_PPTX_TOTAL_BYTES = MAX_WELL_HISTORY_PDF_BYTES;
const WELL_HISTORY_TEXT_PYTHON = process.env.WELL_HISTORY_TEXT_PYTHON ?? "python";
const WELL_HISTORY_TEXT_TIMEOUT_MS = Number(process.env.WELL_HISTORY_TEXT_TIMEOUT_MS ?? 20_000);
const PPT_CONVERT_TIMEOUT_MS = Number(process.env.WELL_HISTORY_PPT_TIMEOUT_MS ?? 120_000);
const UPLOAD_TARGETS = new Set(["loginBg", "loginLogo", "sidebarLogo", "welcomeBg1", "welcomeBg2", "welcomeBg3"]);
const PDF_MIME_TYPE = "application/pdf";
const PPT_MIME_TYPES = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/octet-stream",
]);
const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/avif": ".avif",
};

const oracleDbConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECTION_STRING,
};

const UI_TO_ORACLE_UNIT: Record<string, string> = {
  "采油作业一区": "高采采油作业一区",
  "采油作业二区": "高采采油作业二区",
  "采油作业三区": "高采采油作业三区",
};

const ORACLE_PRODUCTION_METRICS_SQL = `
  ROUND((a.rcyl + a.rcsl + NVL(a.rcyl2, 0)), 1) as liquid,
  ROUND(a.rcyl, 1) as oil,
  NVL(a.rcyl2, 0) as diluent,
  CASE
    WHEN NVL(a.rcyl2, 0) > 0 THEN
      ROUND(100 - 100 * (a.rcyl + NVL(a.rcyl2, 0)) / (a.rcyl + a.rcsl + NVL(a.rcyl2, 0)), 1)
    ELSE
      ROUND(a.rcsl / (a.rcyl + a.rcsl + 0.0001) * 100, 0)
  END as water_cut,
  ROUND((NVL(a.rcbsq, 0) + NVL(a.rcql, 0)), 0) as gas
`;

function hasOracleConfig() {
  return Boolean(
    oracleDbConfig.user &&
    oracleDbConfig.password &&
    oracleDbConfig.connectString,
  );
}

function getOracleScopeName(unit: string) {
  return UI_TO_ORACLE_UNIT[unit] || unit;
}

let oraclePoolPromise: Promise<oracledb.Pool> | null = null;
const activeRefreshJobs = new Map<string, Promise<void>>();

async function getOraclePool() {
  if (!hasOracleConfig()) {
    throw new Error("ORACLE_NOT_CONFIGURED");
  }

  if (!oraclePoolPromise) {
    oraclePoolPromise = oracledb.createPool({
      ...oracleDbConfig,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1,
    });
  }

  return oraclePoolPromise;
}

async function queryOracle<T = Record<string, unknown>>(sql: string, binds: Record<string, unknown> = {}) {
  let connection: oracledb.Connection | undefined;
  try {
    const pool = await getOraclePool();
    connection = await pool.getConnection();
    const result = await connection.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return { success: true as const, rows: (result.rows ?? []) as T[] };
  } catch (error: any) {
    return {
      success: false as const,
      error: error?.message || "Oracle query failed",
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error("Error closing Oracle connection:", closeError);
      }
    }
  }
}

function formatStartDate(startDate: string) {
  return `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`;
}

function parseYmdToDate(value: string) {
  const formatted = formatStartDate(value);
  const date = new Date(`${formatted}T00:00:00.000Z`);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: "${value}" → "${formatted}" (not a valid ISO date)`);
  }
  return date;
}

function formatDateToYmd(value: Date) {
  return value.toISOString().slice(0, 10).replace(/-/g, '');
}

function getTodayYmd() {
  return formatDateToYmd(new Date());
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function getMonthWindows(startDate: string, endDate: string) {
  const windows: Array<{ startDate: string; endDate: string; chunkKey: string }> = [];
  const start = parseYmdToDate(startDate);
  const end = parseYmdToDate(endDate);
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

  while (cursor <= end) {
    const monthStart = cursor < start ? start : cursor;
    const nextMonthStart = addMonths(cursor, 1);
    const monthEnd = new Date(Math.min(nextMonthStart.getTime() - 24 * 60 * 60 * 1000, end.getTime()));
    windows.push({
      startDate: formatDateToYmd(monthStart),
      endDate: formatDateToYmd(monthEnd),
      chunkKey: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`,
    });
    cursor = nextMonthStart;
  }

  return windows;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function ensureUploadDirectories() {
  await fs.mkdir(SYSTEM_UPLOAD_DIR, { recursive: true });
  await fs.mkdir(WELL_HISTORY_UPLOAD_DIR, { recursive: true });
  await fs.mkdir(WELL_HISTORY_SOURCE_UPLOAD_DIR, { recursive: true });
}

function sanitizeUploadTarget(target: string) {
  return target.replace(/[^a-zA-Z0-9_-]/g, "") || "image";
}

function sanitizeFileSegment(value: string, fallback: string) {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return sanitized || fallback;
}

function getFileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

export function validatePptxRequestContentLength(value: string | string[] | undefined) {
  if (value === undefined || Array.isArray(value) || !/^\d+$/.test(value)) {
    return { ok: false as const, code: "pptx-content-length-required" as const };
  }
  if (Number(value) > MAX_WELL_HISTORY_PPTX_TOTAL_BYTES) {
    return { ok: false as const, code: "pptx-total-too-large" as const };
  }
  return { ok: true as const };
}

export function validatePptxUploadLimits(
  files: Array<{ size: number }>,
  limits = { maxFiles: MAX_WELL_HISTORY_PPTX_FILES, maxFileBytes: MAX_WELL_HISTORY_PDF_BYTES, maxTotalBytes: MAX_WELL_HISTORY_PPTX_TOTAL_BYTES },
) {
  if (files.length > limits.maxFiles) return { ok: false as const, code: "pptx-file-count-exceeded" as const };
  if (files.some(file => file.size > limits.maxFileBytes)) return { ok: false as const, code: "pptx-file-too-large" as const };
  if (files.reduce((total, file) => total + file.size, 0) > limits.maxTotalBytes) return { ok: false as const, code: "pptx-total-too-large" as const };
  return { ok: true as const };
}

export function validatePptxBaseVersion(currentVersionNo: number, baseVersionNo: unknown) {
  return Number.isInteger(baseVersionNo) && Number(baseVersionNo) === currentVersionNo
    ? { ok: true as const }
    : { ok: false as const, code: "pptx-version-conflict" as const };
}

export function collectWellHistoryPptxFileUrls(current: { fileUrl?: string | null } | null | undefined, versions: Array<{ fileUrl?: string | null }>) {
  return [...new Set([current?.fileUrl, ...versions.map(version => version.fileUrl)].filter((url): url is string => Boolean(url)))];
}

export function validatePptxUploadFileName(fileName: string) {
  const extension = getFileExtension(fileName);
  if (extension === ".pptx" || extension === ".ppt") return { ok: true as const };
  return { ok: false as const, code: "invalid-pptx-file" as const };
}

export function validatePptxEditorDocument(value: unknown) {
  const document = value as Partial<PptxWellHistoryDocument> | null;
  if (!document || !Array.isArray(document.slides) || !document.slides.length || !Array.isArray(document.source)) {
    return { ok: false as const, code: "invalid-pptx-document" as const };
  }
  if (!document.slides.every(slide => slide && typeof slide.id === "string" && typeof slide.path === "string" && typeof slide.xml === "string" && Array.isArray(slide.elements))) {
    return { ok: false as const, code: "invalid-pptx-document" as const };
  }
  return { ok: true as const };
}

export function validatePptxVersionInput(value: unknown) {
  const input = value as { document?: unknown; versionNo?: unknown } | null;
  const document = validatePptxEditorDocument(input?.document);
  if (!document.ok) return document;
  if (input?.versionNo !== undefined && (!Number.isInteger(input.versionNo) || Number(input.versionNo) < 1)) {
    return { ok: false as const, code: "invalid-version-no" as const };
  }
  return { ok: true as const };
}

function isPresentationFile(fileName: string, mimeType?: string) {
  const extension = getFileExtension(fileName);
  return extension === ".ppt" || extension === ".pptx" || (mimeType ? PPT_MIME_TYPES.has(mimeType) && (extension === ".ppt" || extension === ".pptx") : false);
}

type WellHistoryOverlayElement = Record<string, unknown>;

type WellHistoryOverlayPayload = {
  pdfId: string;
  elementsJson: {
    version: number;
    elements: WellHistoryOverlayElement[];
  };
};

function getUploadExtension(mimeType: string) {
  return IMAGE_EXTENSION_BY_MIME[mimeType] ?? "";
}

function isManagedUploadUrl(value: string) {
  return value.startsWith("/uploads/system/");
}

function getManagedUploadPath(value: string) {
  if (!isManagedUploadUrl(value)) {
    return null;
  }
  const fileName = value.slice("/uploads/system/".length);
  if (!fileName || fileName.includes("/") || fileName.includes("\\")) {
    return null;
  }
  return path.join(SYSTEM_UPLOAD_DIR, fileName);
}

async function removeManagedUploadFile(value: string) {
  const filePath = getManagedUploadPath(value);
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.error("Failed to remove managed upload file:", error);
    }
  }
}

function isWellHistoryUploadUrl(value: string) {
  return value.startsWith("/uploads/well-history/");
}

function getWellHistoryUploadPath(value: string) {
  if (!isWellHistoryUploadUrl(value)) {
    return null;
  }
  const fileName = value.slice("/uploads/well-history/".length);
  if (!fileName || fileName.includes("/") || fileName.includes("\\")) {
    return null;
  }
  return path.join(WELL_HISTORY_UPLOAD_DIR, fileName);
}

async function removeWellHistoryUploadFile(value: string) {
  const filePath = getWellHistoryUploadPath(value);
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.error("Failed to remove well history PDF file:", error);
    }
  }
}

async function attachWellHistoryPdfBase64<T extends { currentPdf?: { fileUrl?: string | null } | null }>(archive: T) {
  const fileUrl = archive?.currentPdf?.fileUrl;
  if (!fileUrl) {
    return { ...archive, pdfBase64: null };
  }

  const pdfPath = getWellHistoryUploadPath(fileUrl);
  if (!pdfPath) {
    return { ...archive, pdfBase64: null };
  }

  const pdfBuffer = await fs.readFile(pdfPath);
  return {
    ...archive,
    pdfBase64: pdfBuffer.toString("base64"),
  };
}

async function removeWellHistorySourceFilesForWell(wellNo: string) {
  try {
    const exactWellNo = wellNo.trim();
    if (!exactWellNo) {
      return;
    }

    const sourcePrefix = `${sanitizeFileSegment(exactWellNo, "well")}-`;
    const entries = await fs.readdir(WELL_HISTORY_SOURCE_UPLOAD_DIR, { withFileTypes: true });
    const matchedFiles = entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(sourcePrefix))
      .map((entry) => path.join(WELL_HISTORY_SOURCE_UPLOAD_DIR, entry.name));

    await Promise.allSettled(matchedFiles.map((filePath) => fs.unlink(filePath)));
  } catch {
    // Best-effort cleanup only.
  }
}

async function deleteWellHistoryArchiveByWellNo(wellNo: string) {
  if (!snapshotPrisma.wellHistoryArchive || !snapshotPrisma.wellHistoryPdf) {
    throw new Error("Well history archive tables not available. Run prisma generate/db push first.");
  }

  const exactWellNo = typeof wellNo === "string" ? wellNo.trim() : "";
  const normalizedWellNo = normalizeWellHistoryWellNo(exactWellNo);
  if (!exactWellNo || !normalizedWellNo) {
    throw new Error("wellNo is required");
  }

  let archive = await snapshotPrisma.wellHistoryArchive.findUnique({
    where: { wellNo: exactWellNo },
    include: {
      currentPdf: true,
      currentPptx: true,
      extract: true,
    },
  });

  if (!archive && normalizedWellNo !== exactWellNo) {
    archive = await snapshotPrisma.wellHistoryArchive.findUnique({
      where: { wellNo: normalizedWellNo },
      include: {
        currentPdf: true,
        currentPptx: true,
        extract: true,
      },
    });
  }

  if (!archive) {
    throw new Error("Well history archive not found");
  }

  const currentPdfId = archive.currentPdf?.id ?? null;
  const currentPdfUrl = archive.currentPdf?.fileUrl ?? null;
  const pptxVersions = snapshotPrisma.wellHistoryPptxVersion
    ? await snapshotPrisma.wellHistoryPptxVersion.findMany({ where: { archiveId: archive.id }, select: { fileUrl: true } })
    : [];
  const pptxUrls = collectWellHistoryPptxFileUrls(archive.currentPptx, pptxVersions);
  const archiveWellNo = archive.wellNo;

  if (snapshotPrisma.wellHistoryPdfOverlay && currentPdfId) {
    await snapshotPrisma.wellHistoryPdfOverlay.deleteMany({
      where: {
        wellNo: archiveWellNo,
        pdfId: currentPdfId,
      },
    });
  }

  if (snapshotPrisma.wellHistoryExtract) {
    await snapshotPrisma.wellHistoryExtract.deleteMany({
      where: {
        archiveId: archive.id,
      },
    });
  }

  await snapshotPrisma.wellHistoryArchive.delete({
    where: { wellNo: archiveWellNo },
  });

  await snapshotPrisma.wellHistoryPdf.deleteMany({
    where: { wellNo: archiveWellNo },
  });

  if (currentPdfUrl) {
    await removeWellHistoryUploadFile(currentPdfUrl);
  }
  await Promise.all(pptxUrls.map(removeWellHistoryUploadFile));
  await removeWellHistorySourceFilesForWell(archiveWellNo);
}

async function parseMultipartForm(req: express.Request) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (typeof value === "string") {
      headers.append(key, value);
    }
  }

  const request = new Request(`http://${req.headers.host ?? "localhost"}${req.originalUrl}`, {
    method: req.method,
    headers,
    body: req as unknown as BodyInit,
    duplex: "half",
  } as any);

  return request.formData();
}

function inferWellHistoryDisplayName(wellNo: string) {
  return wellNo.trim() || wellNo;
}

function normalizeWellNoForMatch(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function extractWellSection(rawText: string, wellNo: string) {
  if (!rawText.trim()) {
    return "";
  }

  const lines = rawText.split(/\r?\n/);
  const normalizedWellNo = normalizeWellNoForMatch(wellNo);
  const headingPattern = /^[A-Za-z\u4e00-\u9fa5]+\d+-\d+$/;
  const startIndex = lines.findIndex(line => normalizeWellNoForMatch(line).includes(normalizedWellNo));

  if (startIndex === -1) {
    return rawText;
  }

  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      continue;
    }
    if (headingPattern.test(trimmed) && normalizeWellNoForMatch(trimmed) !== normalizedWellNo) {
      endIndex = i;
      break;
    }
  }

  const sectionLines = lines.slice(startIndex, endIndex);
  return sectionLines.join("\n").trim();
}

function buildExtractSegments(rawText: string, wellNo: string, displayName: string) {
  const sectionText = extractWellSection(rawText, wellNo);
  const lines = rawText
    ? sectionText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
    : [];
  const compactText = sectionText.replace(/\s+/g, " ").trim();
  const layerLines = lines.filter(line => /N\d|层|井段|米|m\/|解释|射孔|合计/i.test(line)).slice(0, 26);
  const title = wellNo;
  const paragraphStart = lines.findIndex(line => /^\d+、/.test(line) || /^投产/.test(line));
  const tablePart = paragraphStart > 0 ? lines.slice(0, paragraphStart) : lines.slice(0, 40);
  const paragraphPart = paragraphStart > 0 ? lines.slice(paragraphStart) : lines.slice(40);
  const summary = compactText ? compactText.slice(0, 280) : null;
  const interpretationText = tablePart.join("\n") || null;
  const conclusionText = paragraphPart.slice(0, 24).join("\n") || null;

  return {
    title,
    summary,
    layersText: layerLines.length ? layerLines.join("\n") : null,
    interpretationText,
    conclusionText,
    rawExtractText: sectionText || null,
  };
}

async function extractWellHistoryPdfText(pdfPath: string) {
  const pythonScript = [
    "from pypdf import PdfReader",
    "import sys",
    "reader = PdfReader(sys.argv[1])",
    "parts = []",
    "for page in reader.pages:",
    "    text = page.extract_text() or ''",
    "    if text:",
    "        parts.append(text)",
    "sys.stdout.buffer.write('\\n'.join(parts).encode('utf-8', errors='ignore'))",
  ].join("\n");

  try {
    const { stdout } = await execFileAsync(WELL_HISTORY_TEXT_PYTHON, ["-c", pythonScript, pdfPath], {
      timeout: WELL_HISTORY_TEXT_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (error) {
    console.error("Failed to extract well history PDF text:", error);
    return "";
  }
}

async function convertPresentationToPdf(sourcePath: string, targetPath: string) {
  const escapedSource = sourcePath.replace(/'/g, "''");
  const escapedTarget = targetPath.replace(/'/g, "''");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$ppt = $null",
    "$presentation = $null",
    "try {",
    "  $ppt = New-Object -ComObject PowerPoint.Application",
    "  $ppt.DisplayAlerts = 1",
    `  $presentation = $ppt.Presentations.Open('${escapedSource}', $false, $false, $false)`,
    `  $presentation.SaveAs('${escapedTarget}', 32)`,
    "} finally {",
    "  if ($presentation -ne $null) { $presentation.Close() }",
    "  if ($ppt -ne $null) { $ppt.Quit() }",
    "  [System.GC]::Collect()",
    "  [System.GC]::WaitForPendingFinalizers()",
    "}",
  ].join("\n");

  await execFileAsync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
    timeout: PPT_CONVERT_TIMEOUT_MS,
    maxBuffer: 8 * 1024 * 1024,
  });

  const pdfStat = await fs.stat(targetPath).catch(() => null);
  if (!pdfStat?.size) {
    throw new Error("PowerPoint conversion did not create a valid PDF file");
  }
}

async function mergePdfBuffers(pdfBuffers: Buffer[]) {
  if (pdfBuffers.length === 1) {
    return pdfBuffers[0];
  }

  const mergedPdf = await PDFDocument.create();
  for (const pdfBuffer of pdfBuffers) {
    const sourcePdf = await PDFDocument.load(pdfBuffer);
    const pageIndices = sourcePdf.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return Buffer.from(await mergedPdf.save());
}

function serializablePptxDocument(document: PptxWellHistoryDocument) {
  return { ...document, source: Array.from(document.source) };
}

function toPptxDocument(value: unknown): PptxWellHistoryDocument {
  const document = value as Omit<PptxWellHistoryDocument, "source"> & { source: number[] };
  return { ...document, source: new Uint8Array(document.source) };
}

type PowerPointSlideExportDependencies = {
  mkdir?: (path: string, options: { recursive: true }) => Promise<unknown>;
  execFileAsync?: (file: string, args: string[], options: { timeout: number; maxBuffer: number }) => Promise<unknown>;
  readdir?: (path: string) => Promise<string[]>;
  readFile?: (path: string) => Promise<Buffer>;
  unlink?: (path: string) => Promise<unknown>;
};

export async function exportPresentationSlidesWithPowerPoint(
  sourcePath: string,
  outputDir: string,
  sourceExtension: string,
  dependencies: PowerPointSlideExportDependencies = {},
) {
  await (dependencies.mkdir ?? fs.mkdir)(outputDir, { recursive: true });
  const escapedSource = sourcePath.replace(/'/g, "''");
  const escapedOutput = outputDir.replace(/'/g, "''");
  const pptxPath = path.join(path.dirname(sourcePath), `${path.parse(sourcePath).name}.pptx`);
  const escapedPptx = pptxPath.replace(/'/g, "''");
  const markerPath = path.join(outputDir, ".powerpoint-pid");
  const saveAsPptx = sourceExtension.toLowerCase() === ".ppt"
    ? `  $presentation.SaveAs('${escapedPptx}', 24)`
    : "";
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$ppt = $null",
    "$presentation = $null",
    `$markerPath = Join-Path '${escapedOutput}' '.powerpoint-pid'`,
    "try {",
    "  $ppt = New-Object -ComObject PowerPoint.Application",
    "  Add-Type -TypeDefinition @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class PowerPointNative { [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId); }",
    "'@",
    "  [uint32]$powerPointProcessId = 0",
    "  [void][PowerPointNative]::GetWindowThreadProcessId([IntPtr]$ppt.HWND, [ref]$powerPointProcessId)",
    "  if ($null -eq $powerPointProcessId -or [int]$powerPointProcessId -le 0) { throw 'powerpoint-process-id-not-found' }",
    "  Set-Content -LiteralPath $markerPath -Value $powerPointProcessId -NoNewline",
    "  $ppt.DisplayAlerts = 1",
    `  $presentation = $ppt.Presentations.Open('${escapedSource}', $false, $false, $false)`,
    saveAsPptx,
    "  for ($index = 1; $index -le $presentation.Slides.Count; $index += 1) {",
    `    $presentation.Slides.Item($index).Export((Join-Path '${escapedOutput}' ('page-' + $index + '.png')), 'PNG')`,
    "  }",
    "} finally {",
    "  try {",
    "    if ($presentation -ne $null) { $presentation.Close() }",
    "  } finally {",
    "    try {",
    "      if ($ppt -ne $null) { $ppt.Quit() }",
    "    } finally {",
    "      try {",
    "        [System.GC]::Collect()",
    "        [System.GC]::WaitForPendingFinalizers()",
    "      } finally {",
    "        Remove-Item -LiteralPath $markerPath -Force -ErrorAction SilentlyContinue",
    "      }",
    "    }",
    "  }",
    "}",
  ].join("\n");

  const converter = dependencies.execFileAsync ?? execFileAsync;
  const removeMarker = async () => {
    await (dependencies.unlink ?? fs.unlink)(markerPath).catch(() => undefined);
  };
  try {
    await converter("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
      timeout: PPT_CONVERT_TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    try {
      const marker = await (dependencies.readFile ?? fs.readFile)(markerPath).catch(() => null);
      const pid = Number(marker?.toString().trim());
      if (Number.isSafeInteger(pid) && pid > 0) {
        await converter("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
          timeout: PPT_CONVERT_TIMEOUT_MS,
          maxBuffer: 8 * 1024 * 1024,
        }).catch(() => undefined);
      }
    } finally {
      await removeMarker();
    }
    throw error;
  }
  await removeMarker();
  const entries = await (dependencies.readdir ?? fs.readdir)(outputDir);
  const pages = entries
    .filter((entry) => /\.png$/i.test(entry))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .map((entry) => path.join(outputDir, entry));
  if (!pages.length) {
    const error = new Error("ppt-page-export-failed");
    (error as Error & { code?: string }).code = "ppt-page-export-failed";
    throw error;
  }
  return pages;
}

export async function cleanupWellHistoryPptImportArtifacts(
  pageDir: string | null,
  movedPagePaths: string[],
  saved: boolean,
  dependencies: {
    rm?: (path: string, options: { recursive: true; force: true }) => Promise<unknown>;
    unlink?: (path: string) => Promise<unknown>;
  } = {},
) {
  if (pageDir) {
    await (dependencies.rm ?? fs.rm)(pageDir, { recursive: true, force: true }).catch(() => undefined);
  }
  if (!saved) {
    await Promise.all(movedPagePaths.map((pagePath) => (dependencies.unlink ?? fs.unlink)(pagePath).catch(() => undefined)));
  }
}

async function saveWellHistoryPptxRecord(input: {
  pptxBuffer: Buffer;
  document: PptxWellHistoryDocument;
  wellNo: string;
  unit: string;
  block?: string | null;
  remark?: string | null;
  savedBy?: string | null;
  originalName: string;
  sourceFormat: string;
  initialHtml: string;
}) {
  if (!snapshotPrisma.wellHistoryPptx || !snapshotPrisma.wellHistoryPptxVersion || !snapshotPrisma.wellHistoryArchive || !snapshotPrisma.wellHistoryRichTextDocument || !snapshotPrisma.wellHistoryRichTextVersion) {
    throw new Error("Well history PPTX tables not available. Run prisma generate/db push first.");
  }
  const wellNo = normalizeWellHistoryWellNo(input.wellNo);
  if (!wellNo) throw new Error("wellNo is required");
  await ensureUploadDirectories();
  const storedFileName = `${sanitizeFileSegment(wellNo, "well")}-${Date.now()}-${randomUUID()}.pptx`;
  const fileUrl = `/uploads/well-history/${storedFileName}`;
  await fs.writeFile(path.join(WELL_HISTORY_UPLOAD_DIR, storedFileName), input.pptxBuffer);
  try {
    const saved = await prisma.$transaction(async (tx) => {
      const archive = await tx.wellHistoryArchive.upsert({
        where: { wellNo },
        create: { wellNo, displayName: inferWellHistoryDisplayName(wellNo), unit: input.unit, block: input.block || null, remark: input.remark || null },
        update: { displayName: inferWellHistoryDisplayName(wellNo), unit: input.unit, block: input.block || null, remark: input.remark || null },
      });
      const existing = await tx.wellHistoryPptx.findUnique({ where: { wellNo } });
      const data = { archiveId: archive.id, wellNo, fileUrl, storedFileName, originalName: input.originalName, sourceFormat: input.sourceFormat, editorModelJson: serializablePptxDocument(input.document), savedBy: input.savedBy || null, remark: input.remark || null };
      const pptx = existing
        ? await tx.wellHistoryPptx.update({ where: { id: existing.id }, data: { ...data, versionNo: existing.versionNo + 1 } })
        : await tx.wellHistoryPptx.create({ data: { ...data, versionNo: 1 } });
      await tx.wellHistoryPptxVersion.create({ data: { ...data, pptxId: pptx.id, versionNo: pptx.versionNo } });
      const existingDocument = await tx.wellHistoryRichTextDocument.findUnique({ where: { archiveId: archive.id } });
      const html = sanitizeWellHistoryHtml(input.initialHtml);
      const richTextDocument = existingDocument
        ? await tx.wellHistoryRichTextDocument.update({ where: { id: existingDocument.id }, data: { wellNo, html, versionNo: existingDocument.versionNo + 1, savedBy: input.savedBy || null } })
        : await tx.wellHistoryRichTextDocument.create({ data: { archiveId: archive.id, wellNo, html, savedBy: input.savedBy || null } });
      await tx.wellHistoryRichTextVersion.create({ data: { documentId: richTextDocument.id, archiveId: archive.id, wellNo, html, versionNo: richTextDocument.versionNo, savedBy: input.savedBy || null } });
      await tx.wellHistoryArchive.update({ where: { id: archive.id }, data: { currentPptxId: pptx.id } });
      return pptx;
    }, { timeout: 30_000 });
    return saved;
  } catch (error) {
    await removeWellHistoryUploadFile(fileUrl);
    throw error;
  }
}

async function saveWellHistoryPdfRecord(input: {
  pdfBuffer: Buffer;
  wellNo: string;
  unit: string;
  block?: string | null;
  remark?: string | null;
  originalName: string;
}) {
  if (!snapshotPrisma.wellHistoryPdf || !snapshotPrisma.wellHistoryArchive || !snapshotPrisma.wellHistoryExtract) {
    throw new Error("Well history archive tables not available. Run prisma generate/db push first.");
  }

  const normalizedWellNo = normalizeWellHistoryWellNo(input.wellNo);
  if (!normalizedWellNo) {
    throw new Error("wellNo is required");
  }

  await ensureUploadDirectories();
  const storedFileName = `${sanitizeFileSegment(normalizedWellNo, "well")}-${Date.now()}-${randomUUID()}.pdf`;
  const diskPath = path.join(WELL_HISTORY_UPLOAD_DIR, storedFileName);
  const fileUrl = `/uploads/well-history/${storedFileName}`;

  await fs.writeFile(diskPath, input.pdfBuffer);

  const existingRecord = await snapshotPrisma.wellHistoryPdf.findUnique({
    where: { wellNo: normalizedWellNo },
  });

  let savedRecord;
  try {
    if (existingRecord) {
      savedRecord = await snapshotPrisma.wellHistoryPdf.update({
        where: { wellNo: normalizedWellNo },
        data: {
          wellNo: normalizedWellNo,
          unit: input.unit,
          block: input.block || null,
          fileUrl,
          storedFileName,
          originalName: input.originalName,
          mimeType: PDF_MIME_TYPE,
          size: input.pdfBuffer.byteLength,
          remark: input.remark || null,
        },
      });

      if (existingRecord.fileUrl !== fileUrl) {
        await removeWellHistoryUploadFile(existingRecord.fileUrl);
      }
    } else {
      savedRecord = await snapshotPrisma.wellHistoryPdf.create({
        data: {
          wellNo: normalizedWellNo,
          unit: input.unit,
          block: input.block || null,
          fileUrl,
          storedFileName,
          originalName: input.originalName,
          mimeType: PDF_MIME_TYPE,
          size: input.pdfBuffer.byteLength,
          remark: input.remark || null,
        },
      });
    }

    await syncWellHistoryArchive(savedRecord);
    return savedRecord;
  } catch (error) {
    await removeWellHistoryUploadFile(fileUrl);
    throw error;
  }
}

async function syncWellHistoryArchive(record: {
  id: string;
  wellNo: string;
  unit: string;
  block: string | null;
  originalName: string;
  remark: string | null;
  fileUrl: string;
}) {
  if (!snapshotPrisma.wellHistoryArchive || !snapshotPrisma.wellHistoryExtract) {
    return null;
  }

  const displayName = inferWellHistoryDisplayName(record.wellNo);
  const archive = await snapshotPrisma.wellHistoryArchive.upsert({
    where: { wellNo: record.wellNo },
    create: {
      wellNo: record.wellNo,
      displayName,
      unit: record.unit,
      block: record.block,
      remark: record.remark,
      currentPdfId: record.id,
    },
    update: {
      displayName,
      unit: record.unit,
      block: record.block,
      remark: record.remark,
      currentPdfId: record.id,
    },
  });

  const pdfPath = getWellHistoryUploadPath(record.fileUrl);
  const extractedText = pdfPath ? await extractWellHistoryPdfText(pdfPath) : "";
  const segments = buildExtractSegments(extractedText, record.wellNo, displayName);
  const normalizedSegments = extractedText
    ? segments
    : {
        ...segments,
        summary: "当前 PDF 暂未提取到可识别文本，已先作为单井档案原件保存，可后续补充 OCR 或人工整理。",
        conclusionText: "原始井史 PDF 已入档，可直接查看原件并继续维护更新。",
      };

  await snapshotPrisma.wellHistoryExtract.upsert({
    where: { archiveId: archive.id },
    create: {
      archiveId: archive.id,
      pdfId: record.id,
      wellNo: record.wellNo,
      extractStatus: extractedText ? "success" : "failed",
      extractSource: extractedText ? "pypdf" : "none",
      ...normalizedSegments,
    },
    update: {
      pdfId: record.id,
      wellNo: record.wellNo,
      extractStatus: extractedText ? "success" : "failed",
      extractSource: extractedText ? "pypdf" : "none",
      ...normalizedSegments,
    },
  });

  return archive;
}

app.use('/uploads', express.static(UPLOAD_ROOT));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// --- Zod Validation Schemas ---
const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  status: z.enum(["Pending", "In Progress", "Auditing", "Completed"]).optional(),
  priority: z.enum(["High", "Medium", "Low"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  deadline: z.string().optional().nullable(),
  fromUnit: z.string(),
  toUnit: z.string(),
});

const MeetingSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string(),
  location: z.string().optional(),
  organizer: z.string(),
});

const WellSchema = z.object({
  id: z.string().min(1),
  unit: z.string(),
  status: z.string(),
  pressure: z.number(),
  injectionRate: z.number(),
});

const DynamicAdjustmentRequestSchema = z.object({
  adjustmentWaterWell: z.string().trim().min(1),
  injectionProcess: z.string().optional().nullable(),
  adjustmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  beforeDailyInjection: z.union([z.number(), z.string(), z.null()]).optional(),
  afterDailyInjection: z.union([z.number(), z.string(), z.null()]).optional(),
  adjustmentPurpose: z.enum(DYNAMIC_ADJUSTMENT_PURPOSES),
  trackedOilWell: z.string().trim().min(1),
  beforeDailyLiquid: z.union([z.number(), z.string(), z.null()]).optional(),
  beforeDailyOil: z.union([z.number(), z.string(), z.null()]).optional(),
  beforeWaterCut: z.union([z.number(), z.string(), z.null()]).optional(),
  afterDailyLiquid: z.union([z.number(), z.string(), z.null()]).optional(),
  afterDailyOil: z.union([z.number(), z.string(), z.null()]).optional(),
  afterWaterCut: z.union([z.number(), z.string(), z.null()]).optional(),
  stageDays: z.union([z.number(), z.string(), z.null()]).optional(),
  cumulativeOil: z.union([z.number(), z.string(), z.null()]).optional(),
  remark: z.string().optional().nullable(),
});

const ProductionUnitSchema = z.enum(["采油作业一区", "采油作业二区", "采油作业三区"]);
const trimText = (value: unknown) => String(value ?? "").trim();

const toIntegerOrNull = (value: unknown) => {
  const parsed = toNumberOrNull(value);
  return parsed === null ? null : Math.trunc(parsed);
};

const toStringList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => trimText(item));
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim());
  }
  return [];
};

const normalizeInjectionTechPayload = (input: Record<string, unknown>) => ({
  wellNo: trimText(input.wellNo),
  block: trimText(input.block),
  workArea: trimText(input.workArea),
  process: trimText(input.process),
  packerCount: toIntegerOrNull(input.packerCount),
  packerModels: toStringList(input.packerModels),
  bottomStructure: trimText(input.bottomStructure),
  washable: trimText(input.washable),
  doublePacker: trimText(input.doublePacker),
  washReminder: toNullableText(input.washReminder),
  lastWorkDate: trimText(input.lastWorkDate),
  runningDate: trimText(input.runningDate),
});

const buildInjectionTechWhere = (query: Record<string, unknown>) => {
  const where: Record<string, unknown> = {};
  if (trimText(query.wellNo)) where.wellNo = { contains: trimText(query.wellNo), mode: "insensitive" };
  if (trimText(query.block)) where.block = trimText(query.block);
  if (trimText(query.workArea)) where.workArea = trimText(query.workArea);
  if (trimText(query.process)) where.process = trimText(query.process);
  if (trimText(query.bottomStructure)) where.bottomStructure = trimText(query.bottomStructure);
  const packerCount = toIntegerOrNull(query.packerCount);
  if (packerCount !== null) where.packerCount = packerCount;
  return where;
};

const buildWellFlushingWhere = (query: Record<string, unknown>) => {
  const where: Record<string, unknown> = {};
  if (trimText(query.unit)) where.unit = trimText(query.unit);
  if (trimText(query.wellNo)) where.wellNo = { contains: trimText(query.wellNo), mode: "insensitive" };
  if (trimText(query.method)) where.method = trimText(query.method);
  const dateRange = buildDateRange(query.fromDate, query.toDate);
  if (Object.keys(dateRange).length) where.washDate = dateRange;
  return where;
};

const buildIndicatorCurveWhere = (query: Record<string, unknown>) => {
  const where: Record<string, unknown> = {};
  if (trimText(query.unit)) where.unit = trimText(query.unit);
  if (trimText(query.block)) where.block = trimText(query.block);
  if (trimText(query.wellNo)) where.wellNo = { contains: trimText(query.wellNo), mode: "insensitive" };
  if (trimText(query.testInterval)) where.testInterval = trimText(query.testInterval);
  const dateRange = buildDateRange(query.fromDate, query.toDate);
  if (Object.keys(dateRange).length) where.testDate = dateRange;
  return where;
};

const ProductionStartDateSchema = z.string().regex(/^\d{8}$/);
const WaterProductionQuerySchema = z.object({
  unit: ProductionUnitSchema,
  startDate: ProductionStartDateSchema.default("20260101"),
});
const HistoryDatasetSchema = z.enum([PRODUCTION_HISTORY_DATASET, WATER_HISTORY_DATASET, "all"]);
const HistoryScopeUnitSchema = z.enum(["采油作业一区", "采油作业二区", "采油作业三区", "all"]);
const HistoryBackfillRequestSchema = z.object({
  dataset: HistoryDatasetSchema.default("all"),
  unit: HistoryScopeUnitSchema.default("all"),
  factoryName: z.string().min(1).default(DEFAULT_ORACLE_FACTORY_NAME),
  startDate: ProductionStartDateSchema.default(HISTORY_BACKFILL_START_DATE),
  endDate: ProductionStartDateSchema.default(new Date().toISOString().slice(0, 10).replace(/-/g, '')),
  dryRun: z.boolean().default(false),
  rebuildSnapshots: z.boolean().default(false),
});

async function fetchProductionRows(unit: string) {
  const oracleScope = getOracleScopeName(unit);
  const result = await queryOracle(
    `
      SELECT *
      FROM (
        SELECT a.jh as jh,
               TO_CHAR(a.rq, 'YYYY-MM-DD') as rq,
               c.jlzh as station,
               c.qkdy as block,
               ${ORACLE_PRODUCTION_METRICS_SQL}
        FROM dba01 a, daa01 c
        WHERE a.jh = c.jh
          AND c.km = :scopeName
          AND a.scsj > 0
          AND a.jh IS NOT NULL
        ORDER BY a.rq DESC, a.jh ASC
      )
      WHERE ROWNUM <= 10
    `,
    { scopeName: oracleScope },
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  const rows: ProductionWellRow[] = result.rows.map((row: Record<string, unknown>) => ({
    unit,
    oracleScope,
    jh: String(row.JH ?? row.jh ?? ""),
    rq: String(row.RQ ?? row.rq ?? ""),
    station: String(row.STATION ?? row.station ?? ""),
    block: String(row.BLOCK ?? row.block ?? ""),
    liquid: Number(row.LIQUID ?? row.liquid ?? 0),
    oil: Number(row.OIL ?? row.oil ?? 0),
    diluent: Number(row.DILUENT ?? row.diluent ?? 0),
    waterCut: Number(row.WATER_CUT ?? row.water_cut ?? 0),
    gas: Number(row.GAS ?? row.gas ?? 0),
  }));

  return { unit, oracleScope, rows };
}

async function fetchProductionValidation(unit: string) {
  const { oracleScope, rows: sampleRows } = await fetchProductionRows(unit);
  const summaryResult = await queryOracle(
    `
      SELECT COUNT(*) as total,
             MIN(TO_CHAR(a.rq, 'YYYY-MM-DD')) as min_date,
             MAX(TO_CHAR(a.rq, 'YYYY-MM-DD')) as max_date,
             COUNT(DISTINCT a.jh) as well_count,
             COUNT(DISTINCT c.jlzh) as station_count,
             COUNT(DISTINCT c.qkdy) as block_count
      FROM dba01 a, daa01 c
      WHERE a.jh = c.jh
        AND c.km = :scopeName
        AND a.scsj > 0
        AND a.jh IS NOT NULL
    `,
    { scopeName: oracleScope },
  );

  if (!summaryResult.success) {
    throw new Error(summaryResult.error);
  }

  const summaryRow = summaryResult.rows[0] as Record<string, unknown> | undefined;
  return {
    unit,
    oracleScope,
    summary: {
      total: Number(summaryRow?.TOTAL ?? summaryRow?.total ?? 0),
      minDate: summaryRow?.MIN_DATE ?? summaryRow?.min_date ?? null,
      maxDate: summaryRow?.MAX_DATE ?? summaryRow?.max_date ?? null,
      wellCount: Number(summaryRow?.WELL_COUNT ?? summaryRow?.well_count ?? 0),
      stationCount: Number(summaryRow?.STATION_COUNT ?? summaryRow?.station_count ?? 0),
      blockCount: Number(summaryRow?.BLOCK_COUNT ?? summaryRow?.block_count ?? 0),
    },
    sampleRows,
  };
}

interface ProductionWellRow {
  unit: string;
  oracleScope: string;
  jh: string;
  rq: string;
  station: string;
  block: string;
  liquid: number;
  oil: number;
  diluent: number;
  waterCut: number;
  gas: number;
}

interface WaterWellRow {
  unit: string;
  oracleScope: string;
  factory: string;
  jh: string;
  block: string;
  station: string;
  rq: string;
  productionHours: number;
  injectionMode: string;
  trunkPressure: number;
  oilPressure: number;
  casingPressure: number;
  valveGroupPressure: number;
  manifoldPressure: number;
  wellheadIron: number;
  wellheadImpurity: number;
  allocatedWater: number;
  dailyWater: number;
  injectedLiquid: number;
  allocatedLayers: number;
  overflow: number;
  remarkCode: string;
  remark: string;
}

interface ProductionHistoryRow extends ProductionWellRow {
  factory: string;
  productionHours: number;
  dailyGas: number;
  tailGas: number;
  remark: string;
  cc: number | null;
  strokeCount: number | null;
  pumpDiameter: number | null;
}

interface HistoryChunkWindow {
  startDate: string;
  endDate: string;
  chunkKey: string;
}

interface HistoryImportOptions {
  datasets: Array<typeof PRODUCTION_HISTORY_DATASET | typeof WATER_HISTORY_DATASET>;
  units: string[];
  factoryName: string;
  startDate: string;
  endDate: string;
  dryRun: boolean;
  rebuildSnapshots: boolean;
}

interface HistoryImportSummary {
  dataset: string;
  unit: string;
  chunkKey: string;
  oracleScope: string;
  startDate: string;
  endDate: string;
  fetchedRows: number;
  insertedRows: number;
  dryRun: boolean;
}

interface WaterDailyBlockStat {
  unit: string;
  oracleScope: string;
  block: string;
  rq: string;
  total: number;
  open: number;
  injection: number;
}

function roundNumber(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function averageNumbers(values: number[], decimals = 2) {
  if (values.length === 0) {
    return 0;
  }
  return roundNumber(values.reduce((sum, value) => sum + value, 0) / values.length, decimals);
}

function getPreviousMonthKey(dateString: string) {
  const [yearText, monthText] = dateString.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  return `${String(previousYear).padStart(4, '0')}-${String(previousMonth).padStart(2, '0')}`;
}

function buildWaterWellSummary(rows: WaterWellRow[]) {
  const dates = rows.map(row => row.rq).filter(Boolean);
  const wells = new Set(rows.map(row => row.jh).filter(Boolean));
  const stations = new Set(rows.map(row => row.station).filter(Boolean));
  const blocks = new Set(rows.map(row => row.block).filter(Boolean));
  return {
    total: rows.length,
    minDate: dates.length > 0 ? dates.reduce((min, date) => date < min ? date : min) : null,
    maxDate: dates.length > 0 ? dates.reduce((max, date) => date > max ? date : max) : null,
    wellCount: wells.size,
    stationCount: stations.size,
    blockCount: blocks.size,
    totalDailyWater: roundNumber(rows.reduce((sum, row) => sum + row.dailyWater, 0), 2),
    totalInjectedLiquid: roundNumber(rows.reduce((sum, row) => sum + row.injectedLiquid, 0), 2),
  };
}

function buildWaterDailyBlockStats(rows: WaterWellRow[]) {
  const dailyBlockMap = new Map<string, { unit: string; oracleScope: string; block: string; rq: string; wells: Set<string>; openWells: Set<string>; injection: number }>();

  for (const row of rows) {
    const key = `${row.block}::${row.rq}`;
    const existing = dailyBlockMap.get(key) ?? {
      unit: row.unit,
      oracleScope: row.oracleScope,
      block: row.block,
      rq: row.rq,
      wells: new Set<string>(),
      openWells: new Set<string>(),
      injection: 0,
    };
    existing.wells.add(row.jh);
    if (row.productionHours > 0) {
      existing.openWells.add(row.jh);
    }
    existing.injection += row.dailyWater;
    dailyBlockMap.set(key, existing);
  }

  return Array.from(dailyBlockMap.values()).map(item => ({
    unit: item.unit,
    oracleScope: item.oracleScope,
    block: item.block,
    rq: item.rq,
    total: item.wells.size,
    open: item.openWells.size,
    injection: roundNumber(item.injection, 2),
  }));
}

function normalizeDateOnly(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value ?? "").slice(0, 10);
}

async function fetchProductionValidationFromHistory(unit: string) {
  if (!snapshotPrisma.productionWellHistory) {
    throw new Error("Production history table not available");
  }

  const oracleScopeRow = await prisma.$queryRaw<Array<{ oracleScope: string }>>`
    SELECT "oracleScope"
    FROM "ProductionWellHistory"
    WHERE unit = ${unit}
    ORDER BY rq DESC, jh ASC
    LIMIT 1
  `;
  const oracleScope = oracleScopeRow[0]?.oracleScope ?? getOracleScopeName(unit);

  const summaryRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT COUNT(*)::int AS total,
           MIN(rq)::text AS min_date,
           MAX(rq)::text AS max_date,
           COUNT(DISTINCT jh)::int AS well_count,
           COUNT(DISTINCT station)::int AS station_count,
           COUNT(DISTINCT block)::int AS block_count
    FROM "ProductionWellHistory"
    WHERE unit = ${unit}
  `;

  const sampleHistoryRows = await snapshotPrisma.productionWellHistory.findMany({
    where: { unit },
    orderBy: [{ rq: "desc" }, { jh: "asc" }],
    take: 10,
  });

  const summaryRow = summaryRows[0] ?? {};
  return {
    unit,
    oracleScope,
    summary: {
      total: Number(summaryRow.total ?? 0),
      minDate: summaryRow.min_date ?? null,
      maxDate: summaryRow.max_date ?? null,
      wellCount: Number(summaryRow.well_count ?? 0),
      stationCount: Number(summaryRow.station_count ?? 0),
      blockCount: Number(summaryRow.block_count ?? 0),
    },
    sampleRows: sampleHistoryRows.map((row: any) => ({
      unit: row.unit,
      oracleScope: row.oracleScope,
      jh: row.jh,
      rq: normalizeDateOnly(row.rq),
      station: row.station,
      block: row.block,
      liquid: row.liquid,
      oil: row.oil,
      diluent: row.diluent,
      waterCut: row.waterCut,
      gas: row.gas,
    })),
  };
}

async function fetchWaterWellValidationFromHistory(unit: string, startDate: string) {
  if (!snapshotPrisma.waterWellHistory) {
    throw new Error("Water history table not available");
  }

  const startDateValue = parseYmdToDate(startDate);
  const oracleScopeRow = await prisma.$queryRaw<Array<{ oracleScope: string }>>`
    SELECT "oracleScope"
    FROM "WaterWellHistory"
    WHERE unit = ${unit}
      AND rq >= ${startDateValue}
    ORDER BY rq DESC, jh ASC
    LIMIT 1
  `;
  const oracleScope = oracleScopeRow[0]?.oracleScope ?? getOracleScopeName(unit);

  const summaryRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT COUNT(*)::int AS total,
           MIN(rq)::text AS min_date,
           MAX(rq)::text AS max_date,
           COUNT(DISTINCT jh)::int AS well_count,
           COUNT(DISTINCT station)::int AS station_count,
           COUNT(DISTINCT block)::int AS block_count,
           ROUND(COALESCE(SUM("dailyWater"), 0)::numeric, 2)::float8 AS total_daily_water,
           ROUND(COALESCE(SUM("injectedLiquid"), 0)::numeric, 2)::float8 AS total_injected_liquid
    FROM "WaterWellHistory"
    WHERE unit = ${unit}
      AND rq >= ${startDateValue}
  `;

  const sampleHistoryRows = await snapshotPrisma.waterWellHistory.findMany({
    where: {
      unit,
      rq: { gte: startDateValue },
    },
    orderBy: [{ rq: "desc" }, { jh: "asc" }],
    take: 10,
  });

  const summaryRow = summaryRows[0] ?? {};
  return {
    unit,
    oracleScope,
    startDate,
    summary: {
      total: Number(summaryRow.total ?? 0),
      minDate: summaryRow.min_date ?? null,
      maxDate: summaryRow.max_date ?? null,
      wellCount: Number(summaryRow.well_count ?? 0),
      stationCount: Number(summaryRow.station_count ?? 0),
      blockCount: Number(summaryRow.block_count ?? 0),
      totalDailyWater: Number(summaryRow.total_daily_water ?? 0),
      totalInjectedLiquid: Number(summaryRow.total_injected_liquid ?? 0),
    },
    sampleRows: sampleHistoryRows.map((row: any) => ({
      unit: row.unit,
      oracleScope: row.oracleScope,
      factory: row.factory,
      jh: row.jh,
      block: row.block,
      station: row.station,
      rq: normalizeDateOnly(row.rq),
      productionHours: row.productionHours,
      injectionMode: row.injectionMode,
      trunkPressure: row.trunkPressure,
      oilPressure: row.oilPressure,
      casingPressure: row.casingPressure,
      valveGroupPressure: row.valveGroupPressure,
      manifoldPressure: row.manifoldPressure,
      wellheadIron: row.wellheadIron,
      wellheadImpurity: row.wellheadImpurity,
      allocatedWater: row.allocatedWater,
      dailyWater: row.dailyWater,
      injectedLiquid: row.injectedLiquid,
      allocatedLayers: row.allocatedLayers,
      overflow: row.overflow,
      remarkCode: row.remarkCode ?? "",
      remark: row.remark ?? "",
    })),
  };
}

function buildWaterProductionComparisonFromDailyStats(unit: string, oracleScope: string, startDate: string, dailyBlockStats: WaterDailyBlockStat[]) {
  const latestDate = dailyBlockStats.reduce((max, row) => row.rq > max ? row.rq : max, '');
  const previousMonth = latestDate ? getPreviousMonthKey(latestDate) : null;
  const blocks = Array.from(new Set(dailyBlockStats.map(item => item.block))).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const comparisonRows = blocks.map(block => {
    const latestStat = dailyBlockStats.find(item => item.block === block && item.rq === latestDate);
    const previousStats = previousMonth
      ? dailyBlockStats.filter(item => item.block === block && item.rq.startsWith(previousMonth))
      : [];
    const prevTotal = averageNumbers(previousStats.map(item => item.total), 1);
    const prevOpen = averageNumbers(previousStats.map(item => item.open), 1);
    const prevInjection = averageNumbers(previousStats.map(item => item.injection), 2);
    const total = latestStat?.total ?? 0;
    const open = latestStat?.open ?? 0;
    const injection = latestStat?.injection ?? 0;
    return {
      unit,
      block,
      total,
      open,
      injection,
      prevTotal,
      prevOpen,
      prevInjection,
      diffTotal: roundNumber(total - prevTotal, 1),
      diffOpen: roundNumber(open - prevOpen, 1),
      diffInjection: roundNumber(injection - prevInjection, 2),
    };
  });

  return {
    unit,
    oracleScope,
    startDate,
    latestDate: latestDate || null,
    previousMonth,
    summary: {
      blockCount: comparisonRows.length,
      latestDate: latestDate || null,
      previousMonth,
    },
    rows: comparisonRows,
  };
}

async function fetchProductionHistoryChunk(
  unit: string,
  oracleScope: string,
  factoryName: string,
  startDate: string,
  endDate: string,
): Promise<ProductionHistoryRow[]> {
  const result = await queryOracle(
    `
      SELECT a.jh as jh,
             TO_CHAR(a.rq, 'YYYYMMDD') as rq,
             a.scsj as production_hours,
             c.jlzh as station,
             c.qkdy as block,
             ${ORACLE_PRODUCTION_METRICS_SQL},
             NVL(a.rcql, 0) as daily_gas,
             NVL(a.rcbsq, 0) as tail_gas,
             a.bz as remark,
             a.cc as cc,
             a.cc1 as stroke_count,
             a.bj as pump_diameter
      FROM dba01 a, daa01 c
      WHERE a.jh = c.jh
        AND c.cm LIKE :factoryName
        AND c.km = :scopeName
        AND a.rq >= TO_DATE(:startDate, 'YYYYMMDD')
        AND a.rq <= TO_DATE(:endDate, 'YYYYMMDD')
        AND a.scsj > 0
        AND a.jh IS NOT NULL
      ORDER BY a.rq, a.jh
    `,
    { factoryName, scopeName: oracleScope, startDate, endDate },
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.rows
    .map((row: Record<string, unknown>) => {
      const rq = String(row.RQ ?? row.rq ?? '');
      if (rq.length !== 8) return null;
      return {
        unit,
        oracleScope,
        factory: factoryName.replace(/%/g, ''),
        jh: String(row.JH ?? row.jh ?? ''),
        rq,
        productionHours: Number(row.PRODUCTION_HOURS ?? row.production_hours ?? 0),
        station: String(row.STATION ?? row.station ?? ''),
        block: String(row.BLOCK ?? row.block ?? ''),
        liquid: Number(row.LIQUID ?? row.liquid ?? 0),
        oil: Number(row.OIL ?? row.oil ?? 0),
        diluent: Number(row.DILUENT ?? row.diluent ?? 0),
        waterCut: Number(row.WATER_CUT ?? row.water_cut ?? 0),
        gas: Number(row.GAS ?? row.gas ?? 0),
        dailyGas: Number(row.DAILY_GAS ?? row.daily_gas ?? 0),
        tailGas: Number(row.TAIL_GAS ?? row.tail_gas ?? 0),
        remark: String(row.REMARK ?? row.remark ?? ''),
        cc: row.CC != null || row.cc != null ? Number(row.CC ?? row.cc) : null,
        strokeCount: row.STROKE_COUNT != null || row.stroke_count != null ? Number(row.STROKE_COUNT ?? row.stroke_count) : null,
        pumpDiameter: row.PUMP_DIAMETER != null || row.pump_diameter != null ? Number(row.PUMP_DIAMETER ?? row.pump_diameter) : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

async function fetchWaterHistoryChunk(
  unit: string,
  oracleScope: string,
  factoryName: string,
  startDate: string,
  endDate: string,
): Promise<WaterWellRow[]> {
  const result = await queryOracle(
    `
      SELECT c.cm as factory,
             a.jh as jh,
             c.qkdy as block,
             a.jlzh as station,
             TO_CHAR(a.rq, 'YYYYMMDD') as rq,
             a.scsj as production_hours,
             a.zsfs as injection_mode,
             a.gxyl as trunk_pressure,
             a.yy as oil_pressure,
             a.ty as casing_pressure,
             a.fzyl as valve_group_pressure,
             a.hgyl as manifold_pressure,
             a.jkht as wellhead_iron,
             a.jkzz as wellhead_impurity,
             a.rpzsl as allocated_water,
             a.rzsl as daily_water,
             a.zryl as injected_liquid,
             a.pzcds as allocated_layers,
             a.yll as overflow,
             a.bzdm as remark_code,
             a.bz as remark
      FROM dba02 a, daa01 c
      WHERE a.jh = c.jh
        AND c.cm LIKE :factoryName
        AND c.km = :scopeName
        AND a.rq >= TO_DATE(:startDate, 'YYYYMMDD')
        AND a.rq <= TO_DATE(:endDate, 'YYYYMMDD')
        AND a.rq IS NOT NULL
      ORDER BY a.rq, a.jh
    `,
    { factoryName, scopeName: oracleScope, startDate, endDate },
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.rows
    .map((row: Record<string, unknown>) => {
      const rq = String(row.RQ ?? row.rq ?? '');
      // Skip rows with missing/invalid dates (rq should be YYYYMMDD format, 8 chars)
      if (rq.length !== 8) return null;
      return {
        unit,
        oracleScope,
        factory: String(row.FACTORY ?? row.factory ?? ''),
        jh: String(row.JH ?? row.jh ?? ''),
        block: String(row.BLOCK ?? row.block ?? '未分区块') || '未分区块',
        station: String(row.STATION ?? row.station ?? ''),
        rq,
        productionHours: Number(row.PRODUCTION_HOURS ?? row.production_hours ?? 0),
        injectionMode: String(row.INJECTION_MODE ?? row.injection_mode ?? ''),
        trunkPressure: Number(row.TRUNK_PRESSURE ?? row.trunk_pressure ?? 0),
        oilPressure: Number(row.OIL_PRESSURE ?? row.oil_pressure ?? 0),
        casingPressure: Number(row.CASING_PRESSURE ?? row.casing_pressure ?? 0),
        valveGroupPressure: Number(row.VALVE_GROUP_PRESSURE ?? row.valve_group_pressure ?? 0),
        manifoldPressure: Number(row.MANIFOLD_PRESSURE ?? row.manifold_pressure ?? 0),
        wellheadIron: Number(row.WELLHEAD_IRON ?? row.wellhead_iron ?? 0),
        wellheadImpurity: Number(row.WELLHEAD_IMPURITY ?? row.wellhead_impurity ?? 0),
        allocatedWater: Number(row.ALLOCATED_WATER ?? row.allocated_water ?? 0),
        dailyWater: Number(row.DAILY_WATER ?? row.daily_water ?? 0),
        injectedLiquid: Number(row.INJECTED_LIQUID ?? row.injected_liquid ?? 0),
        allocatedLayers: Number(row.ALLOCATED_LAYERS ?? row.allocated_layers ?? 0),
        overflow: Number(row.OVERFLOW ?? row.overflow ?? 0),
        remarkCode: String(row.REMARK_CODE ?? row.remark_code ?? ''),
        remark: String(row.REMARK ?? row.remark ?? ''),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

async function fetchWaterWellRows(unit: string, startDate: string) {
  const oracleScope = getOracleScopeName(unit);
  const result = await queryOracle(
    `
      SELECT c.cm as factory,
             a.jh as jh,
             c.qkdy as block,
             a.jlzh as station,
             TO_CHAR(a.rq, 'YYYY-MM-DD') as rq,
             a.scsj as production_hours,
             a.zsfs as injection_mode,
             a.gxyl as trunk_pressure,
             a.yy as oil_pressure,
             a.ty as casing_pressure,
             a.fzyl as valve_group_pressure,
             a.hgyl as manifold_pressure,
             a.jkht as wellhead_iron,
             a.jkzz as wellhead_impurity,
             a.rpzsl as allocated_water,
             a.rzsl as daily_water,
             a.zryl as injected_liquid,
             a.pzcds as allocated_layers,
             a.yll as overflow,
             a.bzdm as remark_code,
             a.bz as remark
      FROM dba02 a, daa01 c
      WHERE a.jh = c.jh
        AND c.cm LIKE :factoryName
        AND c.km = :scopeName
        AND a.rq >= TO_DATE(:startDate, 'YYYYMMDD')
      ORDER BY a.rq DESC, a.jh ASC
    `,
    { factoryName: '%高升采油厂%', scopeName: oracleScope, startDate },
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  const rows = result.rows.map((row: Record<string, unknown>) => ({
    unit,
    oracleScope,
    factory: String(row.FACTORY ?? row.factory ?? ''),
    jh: String(row.JH ?? row.jh ?? ''),
    block: String(row.BLOCK ?? row.block ?? '未分区块') || '未分区块',
    station: String(row.STATION ?? row.station ?? ''),
    rq: String(row.RQ ?? row.rq ?? ''),
    productionHours: Number(row.PRODUCTION_HOURS ?? row.production_hours ?? 0),
    injectionMode: String(row.INJECTION_MODE ?? row.injection_mode ?? ''),
    trunkPressure: Number(row.TRUNK_PRESSURE ?? row.trunk_pressure ?? 0),
    oilPressure: Number(row.OIL_PRESSURE ?? row.oil_pressure ?? 0),
    casingPressure: Number(row.CASING_PRESSURE ?? row.casing_pressure ?? 0),
    valveGroupPressure: Number(row.VALVE_GROUP_PRESSURE ?? row.valve_group_pressure ?? 0),
    manifoldPressure: Number(row.MANIFOLD_PRESSURE ?? row.manifold_pressure ?? 0),
    wellheadIron: Number(row.WELLHEAD_IRON ?? row.wellhead_iron ?? 0),
    wellheadImpurity: Number(row.WELLHEAD_IMPURITY ?? row.wellhead_impurity ?? 0),
    allocatedWater: Number(row.ALLOCATED_WATER ?? row.allocated_water ?? 0),
    dailyWater: Number(row.DAILY_WATER ?? row.daily_water ?? 0),
    injectedLiquid: Number(row.INJECTED_LIQUID ?? row.injected_liquid ?? 0),
    allocatedLayers: Number(row.ALLOCATED_LAYERS ?? row.allocated_layers ?? 0),
    overflow: Number(row.OVERFLOW ?? row.overflow ?? 0),
    remarkCode: String(row.REMARK_CODE ?? row.remark_code ?? ''),
    remark: String(row.REMARK ?? row.remark ?? ''),
  }));

  return { unit, oracleScope, rows };
}

async function fetchWaterWellValidation(unit: string, startDate: string) {
  const { oracleScope, rows } = await fetchWaterWellRows(unit, startDate);
  return {
    unit,
    oracleScope,
    startDate,
    summary: buildWaterWellSummary(rows),
    sampleRows: rows.slice(0, 10),
  };
}

async function fetchWaterProductionComparison(unit: string, startDate: string) {
  const { oracleScope, rows } = await fetchWaterWellRows(unit, startDate);
  const dailyBlockStats = buildWaterDailyBlockStats(rows);
  return buildWaterProductionComparisonFromDailyStats(unit, oracleScope, startDate, dailyBlockStats);
}

async function createRefreshBatch(dataset: string, trigger: string) {
  if (!snapshotPrisma.oracleRefreshBatch) {
    return null;
  }

  await snapshotPrisma.oracleRefreshBatch.updateMany({
    where: { dataset, status: "RUNNING" },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      isActive: false,
      error: "Interrupted by a newer refresh run",
    },
  });

  return snapshotPrisma.oracleRefreshBatch.create({
    data: {
      dataset,
      trigger,
      status: "RUNNING",
      isActive: false,
    },
  });
}

async function markRefreshBatchFailed(batchId: string, error: unknown) {
  if (!snapshotPrisma.oracleRefreshBatch) {
    return;
  }

  await snapshotPrisma.oracleRefreshBatch.update({
    where: { id: batchId },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      isActive: false,
      error: serializeError(error),
    },
  });
}

async function activateRefreshBatch(dataset: string, batchId: string, rowCount: number) {
  if (!snapshotPrisma.oracleRefreshBatch) {
    return;
  }

  await snapshotPrisma.oracleRefreshBatch.updateMany({
    where: {
      dataset,
      isActive: true,
      NOT: { id: batchId },
    },
    data: { isActive: false },
  });

  await snapshotPrisma.oracleRefreshBatch.update({
    where: { id: batchId },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      isActive: true,
      rowCount,
      error: null,
    },
  });
}

async function getLatestActiveBatch(dataset: string) {
  if (!snapshotPrisma.oracleRefreshBatch) {
    return null;
  }

  return snapshotPrisma.oracleRefreshBatch.findFirst({
    where: { dataset, isActive: true, status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
  });
}

async function getLatestBatchStatus(dataset: string) {
  if (!snapshotPrisma.oracleRefreshBatch) {
    return null;
  }

  return snapshotPrisma.oracleRefreshBatch.findFirst({
    where: { dataset },
    orderBy: { startedAt: "desc" },
  });
}

async function refreshProductionSnapshots(trigger: string) {
  if (!snapshotPrisma.productionWellSnapshot) {
    return { rowCount: 0 };
  }

  const batch = await createRefreshBatch(PRODUCTION_SNAPSHOT_DATASET, trigger);
  if (!batch) {
    return { rowCount: 0 };
  }

  try {
    const results = await Promise.all(PRODUCTION_UNITS.map(unit => fetchProductionRows(unit)));
    const rows = results.flatMap(result => result.rows);
    await snapshotPrisma.productionWellSnapshot.deleteMany({ where: { batchId: batch.id } });
    if (rows.length > 0) {
      await snapshotPrisma.productionWellSnapshot.createMany({
        data: rows.map((row, index) => ({
          batchId: batch.id,
          unit: row.unit,
          oracleScope: row.oracleScope,
          jh: row.jh,
          rq: row.rq,
          station: row.station,
          block: row.block,
          liquid: row.liquid,
          oil: row.oil,
          diluent: row.diluent,
          waterCut: row.waterCut,
          gas: row.gas,
          rank: index,
        })),
      });
    }
    await activateRefreshBatch(PRODUCTION_SNAPSHOT_DATASET, batch.id, rows.length);
    return { rowCount: rows.length };
  } catch (error) {
    await markRefreshBatchFailed(batch.id, error);
    throw error;
  }
}

async function refreshWaterSnapshots(trigger: string) {
  if (!snapshotPrisma.waterBlockDailySnapshot) {
    return { rowCount: 0 };
  }

  const batch = await createRefreshBatch(WATER_SNAPSHOT_DATASET, trigger);
  if (!batch) {
    return { rowCount: 0 };
  }

  try {
    const results = await Promise.all(PRODUCTION_UNITS.map(unit => fetchWaterWellRows(unit, WATER_SNAPSHOT_START_DATE)));
    const rows = results.flatMap(result => buildWaterDailyBlockStats(result.rows));
    await snapshotPrisma.waterBlockDailySnapshot.deleteMany({ where: { batchId: batch.id } });
    if (rows.length > 0) {
      await snapshotPrisma.waterBlockDailySnapshot.createMany({
        data: rows.map(row => ({
          batchId: batch.id,
          unit: row.unit,
          oracleScope: row.oracleScope,
          block: row.block,
          rq: row.rq,
          total: row.total,
          open: row.open,
          injection: row.injection,
        })),
      });
    }
    await activateRefreshBatch(WATER_SNAPSHOT_DATASET, batch.id, rows.length);
    return { rowCount: rows.length };
  } catch (error) {
    await markRefreshBatchFailed(batch.id, error);
    throw error;
  }
}

async function runRefreshJob(dataset: string, trigger: string) {
  const existingJob = activeRefreshJobs.get(dataset);
  if (existingJob) {
    return existingJob;
  }

  const job = (async () => {
    try {
      if (dataset === PRODUCTION_SNAPSHOT_DATASET) {
        await refreshProductionSnapshots(trigger);
      } else if (dataset === WATER_SNAPSHOT_DATASET) {
        await refreshWaterSnapshots(trigger);
      }
    } finally {
      activeRefreshJobs.delete(dataset);
    }
  })();

  activeRefreshJobs.set(dataset, job);
  return job;
}

async function createImportRun(params: {
  dataset: string;
  scopeType: string;
  scopeValue: string;
  startDate: string;
  endDate: string;
  chunkKey: string;
  trigger: string;
}) {
  if (!snapshotPrisma.oracleImportRun) {
    throw new Error("OracleImportRun table not available");
  }

  return snapshotPrisma.oracleImportRun.create({
    data: {
      dataset: params.dataset,
      status: "RUNNING",
      trigger: params.trigger,
      scopeType: params.scopeType,
      scopeValue: params.scopeValue,
      startDate: params.startDate,
      endDate: params.endDate,
      chunkKey: params.chunkKey,
    },
  });
}

async function markImportRunCompleted(runId: string, rowCount: number) {
  if (!snapshotPrisma.oracleImportRun) {
    return;
  }

  await snapshotPrisma.oracleImportRun.update({
    where: { id: runId },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      rowCount,
      error: null,
    },
  });
}

async function markImportRunFailed(runId: string, error: unknown) {
  if (!snapshotPrisma.oracleImportRun) {
    return;
  }

  await snapshotPrisma.oracleImportRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      error: serializeError(error),
    },
  });
}

async function importHistoryChunk(
  dataset: typeof PRODUCTION_HISTORY_DATASET | typeof WATER_HISTORY_DATASET,
  unit: string,
  oracleScope: string,
  factoryName: string,
  window: HistoryChunkWindow,
  dryRun: boolean,
  importRunId?: string,
): Promise<HistoryImportSummary> {
  let rows: (ProductionHistoryRow | WaterWellRow)[];

  if (dataset === PRODUCTION_HISTORY_DATASET) {
    rows = await fetchProductionHistoryChunk(unit, oracleScope, factoryName, window.startDate, window.endDate);
  } else {
    rows = await fetchWaterHistoryChunk(unit, oracleScope, factoryName, window.startDate, window.endDate);
  }

  const summary: HistoryImportSummary = {
    dataset,
    unit,
    chunkKey: window.chunkKey,
    oracleScope,
    startDate: window.startDate,
    endDate: window.endDate,
    fetchedRows: rows.length,
    insertedRows: 0,
    dryRun,
  };

  if (!dryRun && rows.length > 0) {
    let insertedCount = 0;

    if (dataset === PRODUCTION_HISTORY_DATASET) {
      const productionRows = rows as ProductionHistoryRow[];
      for (let i = 0; i < productionRows.length; i += HISTORY_INSERT_BATCH_SIZE) {
        const batch = productionRows.slice(i, i + HISTORY_INSERT_BATCH_SIZE);
        const result = await snapshotPrisma.productionWellHistory.createMany({
          data: batch.map(row => ({
            unit: row.unit,
            oracleScope: row.oracleScope,
            factory: row.factory,
            jh: row.jh,
            rq: parseYmdToDate(row.rq),
            productionHours: row.productionHours,
            liquid: row.liquid,
            oil: row.oil,
            diluent: row.diluent,
            waterCut: row.waterCut,
            gas: row.gas,
            dailyGas: row.dailyGas,
            tailGas: row.tailGas,
            station: row.station,
            block: row.block,
            remark: row.remark || null,
            cc: row.cc,
            strokeCount: row.strokeCount,
            pumpDiameter: row.pumpDiameter,
            importRunId: importRunId || "00000000-0000-0000-0000-000000000000",
          })),
          skipDuplicates: true,
        });
        insertedCount += result.count;
      }
    } else {
      const waterRows = rows as WaterWellRow[];
      for (let i = 0; i < waterRows.length; i += HISTORY_INSERT_BATCH_SIZE) {
        const batch = waterRows.slice(i, i + HISTORY_INSERT_BATCH_SIZE);
        const result = await snapshotPrisma.waterWellHistory.createMany({
          data: batch.map(row => ({
            unit: row.unit,
            oracleScope: row.oracleScope,
            factory: row.factory,
            jh: row.jh,
            rq: parseYmdToDate(row.rq),
            block: row.block,
            station: row.station,
            productionHours: row.productionHours,
            injectionMode: row.injectionMode,
            trunkPressure: row.trunkPressure,
            oilPressure: row.oilPressure,
            casingPressure: row.casingPressure,
            valveGroupPressure: row.valveGroupPressure,
            manifoldPressure: row.manifoldPressure,
            wellheadIron: row.wellheadIron,
            wellheadImpurity: row.wellheadImpurity,
            allocatedWater: row.allocatedWater,
            dailyWater: row.dailyWater,
            injectedLiquid: row.injectedLiquid,
            allocatedLayers: row.allocatedLayers,
            overflow: row.overflow,
            remarkCode: row.remarkCode || null,
            remark: row.remark || null,
            importRunId: importRunId || "00000000-0000-0000-0000-000000000000",
          })),
          skipDuplicates: true,
        });
        insertedCount += result.count;
      }
    }

    summary.insertedRows = insertedCount;
  }

  return summary;
}

async function runHistoryBackfill(options: HistoryImportOptions): Promise<HistoryImportSummary[]> {
  const summaries: HistoryImportSummary[] = [];
  const units = options.units;
  const datasets = options.datasets as Array<typeof PRODUCTION_HISTORY_DATASET | typeof WATER_HISTORY_DATASET>;
  const monthWindows = getMonthWindows(options.startDate, options.endDate);

  for (const dataset of datasets) {
    for (const unit of units) {
      const oracleScope = getOracleScopeName(unit);

      for (const window of monthWindows) {
        const run = options.dryRun
          ? null
          : await createImportRun({
              dataset,
              scopeType: "unit",
              scopeValue: unit,
              startDate: window.startDate,
              endDate: window.endDate,
              chunkKey: `${dataset}::${unit}::${window.chunkKey}`,
              trigger: "manual",
            });

        try {
          const summary = await importHistoryChunk(
            dataset,
            unit,
            oracleScope,
            options.factoryName,
            window,
            options.dryRun,
            run?.id,
          );

          if (run) {
            await markImportRunCompleted(run.id, summary.insertedRows);
          }

          summaries.push(summary);
          console.log(
            `[history-backfill] ${dataset} ${unit} ${window.chunkKey}: fetched=${summary.fetchedRows} inserted=${summary.insertedRows}${options.dryRun ? ' (dry-run)' : ''}`,
          );
        } catch (error) {
          if (run) {
            await markImportRunFailed(run.id, error);
          }
          console.error(
            `[history-backfill] FAILED ${dataset} ${unit} ${window.chunkKey}:`,
            serializeError(error),
          );
          summaries.push({
            dataset,
            unit,
            chunkKey: window.chunkKey,
            oracleScope,
            startDate: window.startDate,
            endDate: window.endDate,
            fetchedRows: 0,
            insertedRows: 0,
            dryRun: options.dryRun,
          });
        }
      }
    }
  }

  return summaries;
}

async function rebuildSnapshotsFromHistory() {
  if (!snapshotPrisma.productionWellHistory || !snapshotPrisma.waterWellHistory) {
    return { production: 0, water: 0 };
  }

  const results = { production: 0, water: 0 };

  // Rebuild production snapshots from history
  if (snapshotPrisma.productionWellSnapshot) {
    const batch = await createRefreshBatch(PRODUCTION_SNAPSHOT_DATASET, "history-rebuild");
    if (batch) {
      try {
        const allProductionRows = await snapshotPrisma.productionWellHistory.findMany({
          orderBy: [{ rq: "desc" }, { jh: "asc" }],
        });

        const snapshotRows = allProductionRows.map((row: any, index: number) => ({
          batchId: batch.id,
          unit: row.unit,
          oracleScope: row.oracleScope,
          jh: row.jh,
          rq: formatDateToYmd(new Date(row.rq)),
          station: row.station,
          block: row.block,
          liquid: row.liquid,
          oil: row.oil,
          diluent: row.diluent,
          waterCut: row.waterCut,
          gas: row.gas,
          rank: index,
        }));

        await snapshotPrisma.productionWellSnapshot.deleteMany({ where: { batchId: batch.id } });
        if (snapshotRows.length > 0) {
          for (let i = 0; i < snapshotRows.length; i += HISTORY_INSERT_BATCH_SIZE) {
            await snapshotPrisma.productionWellSnapshot.createMany({
              data: snapshotRows.slice(i, i + HISTORY_INSERT_BATCH_SIZE),
            });
          }
        }
        await activateRefreshBatch(PRODUCTION_SNAPSHOT_DATASET, batch.id, snapshotRows.length);
        results.production = snapshotRows.length;
      } catch (error) {
        await markRefreshBatchFailed(batch.id, error);
        throw error;
      }
    }
  }

  // Rebuild water snapshots from history
  if (snapshotPrisma.waterBlockDailySnapshot) {
    const batch = await createRefreshBatch(WATER_SNAPSHOT_DATASET, "history-rebuild");
    if (batch) {
      try {
        const allWaterRows = await snapshotPrisma.waterWellHistory.findMany({
          orderBy: [{ rq: "desc" }, { block: "asc" }],
        });

        const waterWellRows: WaterWellRow[] = allWaterRows.map((row: any) => ({
          unit: row.unit,
          oracleScope: row.oracleScope,
          factory: row.factory,
          jh: row.jh,
          block: row.block,
          station: row.station,
          rq: formatDateToYmd(new Date(row.rq)),
          productionHours: row.productionHours,
          injectionMode: row.injectionMode,
          trunkPressure: row.trunkPressure,
          oilPressure: row.oilPressure,
          casingPressure: row.casingPressure,
          valveGroupPressure: row.valveGroupPressure,
          manifoldPressure: row.manifoldPressure,
          wellheadIron: row.wellheadIron,
          wellheadImpurity: row.wellheadImpurity,
          allocatedWater: row.allocatedWater,
          dailyWater: row.dailyWater,
          injectedLiquid: row.injectedLiquid,
          allocatedLayers: row.allocatedLayers,
          overflow: row.overflow,
          remarkCode: row.remarkCode,
          remark: row.remark,
        }));

        const dailyBlockStats = buildWaterDailyBlockStats(waterWellRows);
        await snapshotPrisma.waterBlockDailySnapshot.deleteMany({ where: { batchId: batch.id } });
        if (dailyBlockStats.length > 0) {
          for (let i = 0; i < dailyBlockStats.length; i += HISTORY_INSERT_BATCH_SIZE) {
            await snapshotPrisma.waterBlockDailySnapshot.createMany({
              data: dailyBlockStats.slice(i, i + HISTORY_INSERT_BATCH_SIZE).map(row => ({
                batchId: batch.id,
                unit: row.unit,
                oracleScope: row.oracleScope,
                block: row.block,
                rq: row.rq,
                total: row.total,
                open: row.open,
                injection: row.injection,
              })),
            });
          }
        }
        await activateRefreshBatch(WATER_SNAPSHOT_DATASET, batch.id, dailyBlockStats.length);
        results.water = dailyBlockStats.length;
      } catch (error) {
        await markRefreshBatchFailed(batch.id, error);
        throw error;
      }
    }
  }

  return results;
}

// Track active backfill jobs
let activeBackfillJob: Promise<HistoryImportSummary[]> | null = null;

async function getProductionSnapshotResponse(unit: string) {
  const activeBatch = await getLatestActiveBatch(PRODUCTION_SNAPSHOT_DATASET);
  if (!activeBatch || !snapshotPrisma.productionWellSnapshot) {
    return null;
  }

  const rows = await snapshotPrisma.productionWellSnapshot.findMany({
    where: { batchId: activeBatch.id, unit },
    orderBy: [{ rank: "asc" }],
  });

  if (rows.length === 0) {
    return null;
  }

  return {
    unit,
    oracleScope: rows[0].oracleScope,
    rows: rows.map((row: any) => ({
      unit: row.unit,
      jh: row.jh,
      rq: row.rq,
      station: row.station,
      block: row.block,
      liquid: row.liquid,
      oil: row.oil,
      diluent: row.diluent,
      waterCut: row.waterCut,
      gas: row.gas,
    })),
    meta: {
      source: SNAPSHOT_SOURCE,
      lastRefreshedAt: activeBatch.finishedAt,
      refreshInProgress: activeRefreshJobs.has(PRODUCTION_SNAPSHOT_DATASET),
    },
  };
}

async function getWaterSnapshotResponse(unit: string, startDate: string) {
  const activeBatch = await getLatestActiveBatch(WATER_SNAPSHOT_DATASET);
  if (!activeBatch || !snapshotPrisma.waterBlockDailySnapshot) {
    return null;
  }

  const rows = await snapshotPrisma.waterBlockDailySnapshot.findMany({
    where: {
      batchId: activeBatch.id,
      unit,
      rq: { gte: formatStartDate(startDate) },
    },
    orderBy: [{ rq: "desc" }, { block: "asc" }],
  });

  if (rows.length === 0) {
    return null;
  }

  const oracleScope = rows[0].oracleScope;
  const comparison = buildWaterProductionComparisonFromDailyStats(
    unit,
    oracleScope,
    startDate,
    rows.map((row: any) => ({
      unit: row.unit,
      oracleScope: row.oracleScope,
      block: row.block,
      rq: row.rq,
      total: row.total,
      open: row.open,
      injection: row.injection,
    })),
  );

  return {
    ...comparison,
    meta: {
      source: SNAPSHOT_SOURCE,
      lastRefreshedAt: activeBatch.finishedAt,
      refreshInProgress: activeRefreshJobs.has(WATER_SNAPSHOT_DATASET),
    },
  };
}

function getHomeOverviewUnits(unit?: string) {
  if (unit && PRODUCTION_UNITS.includes(unit as (typeof PRODUCTION_UNITS)[number])) {
    return [unit];
  }
  return [...PRODUCTION_UNITS];
}

async function fetchHomeOverview(unit?: string) {
  if (!snapshotPrisma.productionWellHistory || !snapshotPrisma.waterWellHistory) {
    throw new Error("Home overview history tables not available");
  }

  const units = getHomeOverviewUnits(unit);
  const scopeLabel = units.length === 1 ? units[0] : "全厂汇总";

  const unitSql = Prisma.join(units.map(value => Prisma.sql`${value}`));

  const [statsRows, blockRows, chartRows] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      WITH latest_water AS (
        SELECT unit, MAX(rq) AS latest_date
        FROM "WaterWellHistory"
        WHERE unit IN (${unitSql})
        GROUP BY unit
      ),
      latest_prod AS (
        SELECT unit, MAX(rq) AS latest_date
        FROM "ProductionWellHistory"
        WHERE unit IN (${unitSql})
        GROUP BY unit
      ),
      water_latest_rows AS (
        SELECT w.*
        FROM "WaterWellHistory" w
        JOIN latest_water lw
          ON w.unit = lw.unit
         AND w.rq = lw.latest_date
      ),
      prod_latest_rows AS (
        SELECT p.*
        FROM "ProductionWellHistory" p
        JOIN latest_prod lp
          ON p.unit = lp.unit
         AND p.rq = lp.latest_date
      )
      SELECT
        COUNT(DISTINCT wl.jh)::int AS total_wells,
        COUNT(DISTINCT CASE WHEN wl."productionHours" > 0 THEN wl.jh END)::int AS open_wells,
        COUNT(DISTINCT CASE WHEN wl."productionHours" <= 0 OR wl."dailyWater" <= 0 THEN wl.jh END)::int AS abnormal_count,
        ROUND(COALESCE(SUM(wl."dailyWater"), 0)::numeric, 2)::float8 AS today_injection,
        ROUND(COALESCE(AVG(pl."waterCut"), 0)::numeric, 2)::float8 AS avg_water_cut,
        MAX(wl.rq)::text AS latest_water_date,
        MAX(pl.rq)::text AS latest_production_date
      FROM water_latest_rows wl
      FULL OUTER JOIN prod_latest_rows pl
        ON wl.unit = pl.unit
       AND wl.jh = pl.jh
    `),
    prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      WITH latest_water AS (
        SELECT unit, MAX(rq) AS latest_date
        FROM "WaterWellHistory"
        WHERE unit IN (${unitSql})
        GROUP BY unit
      ),
      latest_prod AS (
        SELECT unit, MAX(rq) AS latest_date
        FROM "ProductionWellHistory"
        WHERE unit IN (${unitSql})
        GROUP BY unit
      ),
      water_block AS (
        SELECT
          w.unit,
          w.block,
          MAX(w.rq)::text AS latest_date,
          COUNT(DISTINCT w.jh)::int AS total_wells,
          COUNT(DISTINCT CASE WHEN w."productionHours" > 0 THEN w.jh END)::int AS open_wells,
          ROUND(COALESCE(SUM(w."dailyWater"), 0)::numeric, 2)::float8 AS today_injection
        FROM "WaterWellHistory" w
        JOIN latest_water lw
          ON w.unit = lw.unit
         AND w.rq = lw.latest_date
        GROUP BY w.unit, w.block
      ),
      prod_block AS (
        SELECT
          p.unit,
          p.block,
          ROUND(COALESCE(AVG(p."waterCut"), 0)::numeric, 2)::float8 AS avg_water_cut,
          ROUND(COALESCE(SUM(p.oil), 0)::numeric, 2)::float8 AS oil
        FROM "ProductionWellHistory" p
        JOIN latest_prod lp
          ON p.unit = lp.unit
         AND p.rq = lp.latest_date
        GROUP BY p.unit, p.block
      )
      SELECT
        COALESCE(wb.unit, pb.unit)::text AS unit,
        COALESCE(wb.block, pb.block)::text AS block,
        wb.latest_date,
        COALESCE(wb.total_wells, 0)::int AS total_wells,
        COALESCE(wb.open_wells, 0)::int AS open_wells,
        COALESCE(wb.today_injection, 0)::float8 AS today_injection,
        COALESCE(pb.avg_water_cut, 0)::float8 AS avg_water_cut,
        COALESCE(pb.oil, 0)::float8 AS oil
      FROM water_block wb
      FULL OUTER JOIN prod_block pb
        ON wb.unit = pb.unit
       AND wb.block = pb.block
      ORDER BY COALESCE(wb.unit, pb.unit), COALESCE(wb.block, pb.block)
    `),
    prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT
        EXTRACT(YEAR FROM rq)::int AS year,
        ROUND(COALESCE(SUM(oil), 0)::numeric, 2)::float8 AS oil
      FROM "ProductionWellHistory"
      WHERE unit IN (${unitSql})
      GROUP BY EXTRACT(YEAR FROM rq)
      ORDER BY year
    `),
  ]);

  const statsRow = statsRows[0] ?? {};

  return {
    scopeLabel,
    units,
    stats: {
      totalWells: Number(statsRow.total_wells ?? 0),
      openWells: Number(statsRow.open_wells ?? 0),
      abnormalCount: Number(statsRow.abnormal_count ?? 0),
      todayInjection: Number(statsRow.today_injection ?? 0),
      avgWaterCut: Number(statsRow.avg_water_cut ?? 0),
      latestWaterDate: statsRow.latest_water_date ?? null,
      latestProductionDate: statsRow.latest_production_date ?? null,
    },
    blocks: blockRows.map(row => ({
      unit: String(row.unit ?? ""),
      block: String(row.block ?? ""),
      latestDate: row.latest_date ?? null,
      totalWells: Number(row.total_wells ?? 0),
      openWells: Number(row.open_wells ?? 0),
      todayInjection: Number(row.today_injection ?? 0),
      avgWaterCut: Number(row.avg_water_cut ?? 0),
      oil: Number(row.oil ?? 0),
    })),
    chart: chartRows.map(row => ({
      year: String(row.year ?? ""),
      oil: Number(row.oil ?? 0),
    })),
  };
}

// --- API Routes ---

// 0. Auth & Users
app.get("/api/seed", async (req, res) => {
  try {
    await prisma.user.upsert({
      where: { empId: DEFAULT_ADMIN.empId },
      update: {
        name: DEFAULT_ADMIN.name,
        password: DEFAULT_ADMIN.password,
        role: DEFAULT_ADMIN.role,
        unit: DEFAULT_ADMIN.unit,
        status: DEFAULT_ADMIN.status,
      },
      create: {
        name: DEFAULT_ADMIN.name,
        empId: DEFAULT_ADMIN.empId,
        password: DEFAULT_ADMIN.password,
        role: DEFAULT_ADMIN.role,
        unit: DEFAULT_ADMIN.unit,
        status: DEFAULT_ADMIN.status,
      },
    });

    await prisma.systemConfig.createMany({
      data: DEFAULT_SYSTEM_CONFIGS.map(config => ({ key: config.key, value: config.value })),
      skipDuplicates: true,
    });

    const seeds = buildCoreTableSeedRows();
    const secondBatchSeeds = buildSecondBatchSeedRows();
    const homeReserveSeeds = buildHomeReserveOverviewSeedRows();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await prisma.$transaction(async (tx) => {
          if ((await tx.waterCutRecord.count()) === 0) {
            await tx.waterCutRecord.createMany({
              data: seeds.waterCuts.map((row) => ({ ...row, sampleDate: toDate(row.sampleDate) })),
              skipDuplicates: true,
            });
          }
          if ((await tx.injectionTechRecord.count()) === 0) {
            await tx.injectionTechRecord.createMany({
              data: seeds.injectionTechRecords.map((row) => ({
                ...row,
                lastWorkDate: toDate(row.lastWorkDate),
                runningDate: toDate(row.runningDate),
                packerModels: row.packerModels,
              })),
              skipDuplicates: true,
            });
          }
          if ((await tx.wellFlushingRecord.count()) === 0) {
            await tx.wellFlushingRecord.createMany({
              data: seeds.wellFlushingRecords.map((row) => ({
                ...row,
                washDate: toDate(row.washDate),
                firstLevel: row.firstLevel,
                secondLevel: row.secondLevel,
                suspendedMatter: row.suspendedMatter,
              })),
              skipDuplicates: true,
            });
          }
          if ((await tx.abnormalWellRecord.count()) === 0) {
            await tx.abnormalWellRecord.createMany({ data: seeds.abnormalWellRecords, skipDuplicates: true });
          }
          if ((await tx.dynamicAdjustmentRecord.count()) === 0) {
            await tx.dynamicAdjustmentRecord.createMany({
              data: seeds.dynamicAdjustments.map((row) => ({ ...row, adjustmentDate: toDate(row.adjustmentDate) })),
              skipDuplicates: true,
            });
          }
          if ((await tx.concentricTestRecord.count()) === 0) {
            await tx.concentricTestRecord.createMany({
              data: secondBatchSeeds.concentricTests.map((row) => ({ ...row, testDate: toDate(row.testDate) })),
              skipDuplicates: true,
            });
          }
          if ((await tx.smartTestRecord.count()) === 0) {
            await tx.smartTestRecord.createMany({
              data: secondBatchSeeds.smartTests.map((row) => ({ ...row, testDate: toDate(row.testDate) })),
              skipDuplicates: true,
            });
          }
          if ((await tx.singleWellInjectionEvaluationRecord.count()) === 0) {
            await tx.singleWellInjectionEvaluationRecord.createMany({
              data: secondBatchSeeds.singleWellInjectionEvaluations.map((row) => ({
                ...row,
                evaluationDate: toDate(row.evaluationDate),
              })),
              skipDuplicates: true,
            });
          }
          if ((await tx.singleWellSealEvaluationRecord.count()) === 0) {
            await tx.singleWellSealEvaluationRecord.createMany({
              data: secondBatchSeeds.singleWellSealEvaluations.map((row) => ({
                ...row,
                evaluationDate: toDate(row.evaluationDate),
              })),
              skipDuplicates: true,
            });
          }
          if ((await tx.zonalIndicatorSummaryRecord.count()) === 0) {
            await tx.zonalIndicatorSummaryRecord.createMany({
              data: secondBatchSeeds.zonalIndicatorSummaries,
              skipDuplicates: true,
            });
          }
          if ((await tx.dynamicAnalysisRecord.count()) === 0) {
            await tx.dynamicAnalysisRecord.createMany({
              data: secondBatchSeeds.dynamicAnalysisRows,
              skipDuplicates: true,
            });
          }
          if ((await tx.homeReserveOverviewRecord.count()) === 0) {
            await tx.homeReserveOverviewRecord.createMany({
              data: homeReserveSeeds,
              skipDuplicates: true,
            });
          }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") || attempt === 3) {
          throw error;
        }
      }
    }

    res.json({ message: "Seed successful. Default Admin: GS001 / admin666" });
  } catch (error) {
    res.status(500).json({ error: "Seed failed", details: serializeError(error) });
  }
});

app.patch("/api/users/:id", async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: "User update failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { empId, password } = req.body;
  const isDefaultAdmin = empId === DEFAULT_ADMIN.empId && password === DEFAULT_ADMIN.password;

  try {
    const user = await prisma.user.findUnique({ where: { empId } });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.status !== 'Active') {
      return res.status(403).json({ error: "Account inactive" });
    }
    const { password: _, ...userWithoutPassword } = user;
    res.json({ ...userWithoutPassword, mode: "normal" });
  } catch (error) {
    if (isDefaultAdmin) {
      return res.json({
        id: "offline-admin",
        name: DEFAULT_ADMIN.name,
        empId: DEFAULT_ADMIN.empId,
        email: DEFAULT_ADMIN.email,
        role: DEFAULT_ADMIN.role,
        unit: DEFAULT_ADMIN.unit,
        status: DEFAULT_ADMIN.status,
        mode: "offline",
      });
    }
    res.status(500).json({ error: "Login error", details: serializeError(error) });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Fetch users failed" });
  }
});

app.post("/api/users/register", async (req, res) => {
  try {
    const user = await prisma.user.create({ data: req.body });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: "Registration failed" });
  }
});

// 1. Supervised Tasks (督办任务)
app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({ orderBy: { timestamp: 'desc' } });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const data = TaskSchema.parse(req.body);
    const task = await prisma.task.create({
      data: {
        ...data,
        timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),
        replies: JSON.stringify([])
      },
    });
    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ errors: error.issues });
    res.status(500).json({ error: "Failed to create task" });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...body,
        replies: body.replies ? JSON.stringify(body.replies) : undefined
      },
    });
    res.json({
      ...task,
      replies: task.replies ? JSON.parse(task.replies) : []
    });
  } catch (error) {
    res.status(400).json({ error: "Update failed" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// 2. Meetings (会议安排)
app.get("/api/meetings", async (req, res) => {
  try {
    const meetings = await prisma.meeting.findMany();
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

app.post("/api/meetings", async (req, res) => {
  try {
    const data = MeetingSchema.parse(req.body);
    const meeting = await prisma.meeting.create({ data });
    res.status(201).json(meeting);
  } catch (error) {
    res.status(400).json({ error: "Invalid data" });
  }
});

// 3. Wells (注水井数据)
app.get("/api/wells", async (req, res) => {
  try {
    const wells = await prisma.well.findMany();
    res.json(wells);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch wells" });
  }
});

app.put("/api/wells/:id", async (req, res) => {
  try {
    const data = WellSchema.parse(req.body);
    const well = await prisma.well.upsert({
      where: { id: req.params.id },
      update: data,
      create: data,
    });
    res.json(well);
  } catch (error) {
    res.status(400).json({ error: "Upsert failed" });
  }
});

// 4. Notifications
app.get("/api/notifications", async (req, res) => {
  try {
    const notifs = await prisma.notification.findMany({ orderBy: { time: 'desc' } });
    res.json(notifs);
  } catch (error) {
    res.status(500).json({ error: "Fetch notifications failed" });
  }
});

// 5. Audit Logs
app.get("/api/audit-logs", async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' } });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Fetch logs failed" });
  }
});

app.post("/api/audit-logs", async (req, res) => {
  try {
    const log = await prisma.auditLog.create({ data: req.body });
    res.status(201).json(log);
  } catch (error) {
    res.status(400).json({ error: "Log creation failed" });
  }
});

// 6. Dept Responsibilities
app.get("/api/responsibilities", async (req, res) => {
  try {
    const data = await prisma.deptResponsibility.findMany();
    const map = data.reduce((acc, curr) => ({ ...acc, [curr.unit]: curr.responsibility }), {});
    res.json(map);
  } catch (error) {
    res.status(500).json({ error: "Fetch responsibilities failed" });
  }
});

app.post("/api/responsibilities", async (req, res) => {
  try {
    const { unit, responsibility } = req.body;
    const data = await prisma.deptResponsibility.upsert({
      where: { unit },
      update: { responsibility },
      create: { unit, responsibility }
    });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: "Save responsibility failed" });
  }
});

// 6.1 System Config
app.get("/api/config", async (req, res) => {
  try {
    const configs = await prisma.systemConfig.findMany();
    const map = configs.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
    res.json(map);
  } catch (error) {
    res.status(500).json({ error: "Fetch config failed" });
  }
});

app.post("/api/config", async (req, res) => {
  try {
    const { key, value } = req.body;
    const previousConfig = await prisma.systemConfig.findUnique({ where: { key } });
    const config = await prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });

    if (
      typeof previousConfig?.value === "string" &&
      previousConfig.value !== value &&
      UPLOAD_TARGETS.has(key) &&
      isManagedUploadUrl(previousConfig.value)
    ) {
      await removeManagedUploadFile(previousConfig.value);
    }

    res.json(config);
  } catch (error) {
    res.status(400).json({ error: "Update config failed" });
  }
});

app.post("/api/uploads/image", async (req, res) => {
  try {
    const formData = await parseMultipartForm(req);
    const uploadedFile = formData.get("file");
    const targetValue = formData.get("target");

    if (!(uploadedFile instanceof File)) {
      return res.status(400).json({ error: "Missing image file" });
    }

    if (!uploadedFile.type.startsWith("image/")) {
      return res.status(400).json({ error: "Only image uploads are supported" });
    }

    if (uploadedFile.size > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: "Image file too large" });
    }

    const target = typeof targetValue === "string" && UPLOAD_TARGETS.has(targetValue) ? targetValue : "image";
    const extension = getUploadExtension(uploadedFile.type);
    if (!extension) {
      return res.status(400).json({ error: "Unsupported image type" });
    }

    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    await ensureUploadDirectories();
    const fileName = `${sanitizeUploadTarget(target)}-${Date.now()}-${randomUUID()}${extension}`;
    const diskPath = path.join(SYSTEM_UPLOAD_DIR, fileName);
    await fs.writeFile(diskPath, fileBuffer);

    res.json({
      url: `/uploads/system/${fileName}`,
      originalName: uploadedFile.name,
      mimeType: uploadedFile.type,
      size: uploadedFile.size,
    });
  } catch (error) {
    res.status(500).json({ error: "Image upload failed", details: serializeError(error) });
  }
});

app.post("/api/uploads/well-history-pdf", async (req, res) => {
  try {
    const formData = await parseMultipartForm(req);
    const uploadedFile = formData.get("file");
    const wellNoValue = formData.get("wellNo");
    const unitValue = formData.get("unit");
    const blockValue = formData.get("block");
    const remarkValue = formData.get("remark");

    if (!(uploadedFile instanceof File)) {
      return res.status(400).json({ error: "Missing PDF file" });
    }

    if (uploadedFile.type !== PDF_MIME_TYPE) {
      return res.status(400).json({ error: "Only PDF uploads are supported" });
    }

    if (uploadedFile.size > MAX_WELL_HISTORY_PDF_BYTES) {
      return res.status(413).json({ error: "PDF file too large" });
    }

    const wellNo = typeof wellNoValue === "string" ? wellNoValue.trim() : "";
    const unit = typeof unitValue === "string" ? unitValue.trim() : "";
    const block = typeof blockValue === "string" ? blockValue.trim() : "";
    const remark = typeof remarkValue === "string" ? remarkValue.trim() : "";

    if (!wellNo) {
      return res.status(400).json({ error: "wellNo is required" });
    }

    if (!unit) {
      return res.status(400).json({ error: "unit is required" });
    }

    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const savedRecord = await saveWellHistoryPdfRecord({
      pdfBuffer: fileBuffer,
      wellNo,
      unit,
      block: block || null,
      remark: remark || null,
      originalName: uploadedFile.name,
    });

    res.json(savedRecord);
  } catch (error) {
    res.status(500).json({ error: "Well history PDF upload failed", details: serializeError(error) });
  }
});

app.get("/api/well-history-pdf", async (req, res) => {
  try {
    if (!snapshotPrisma.wellHistoryPdf) {
      return res.status(503).json({ error: "Well history PDF table not available. Run prisma generate/db push first." });
    }

    const wellNo = typeof req.query.wellNo === "string" ? req.query.wellNo.trim() : "";
    if (!wellNo) {
      return res.status(400).json({ error: "wellNo is required" });
    }

    const record = await snapshotPrisma.wellHistoryPdf.findUnique({
      where: { wellNo },
    });

    if (!record) {
      return res.status(404).json({ error: "Well history PDF not found" });
    }

    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Fetch well history PDF failed" });
  }
});

app.post("/api/uploads/well-history-ppt-batch", async (req, res) => {
  try {
    const contentLength = validatePptxRequestContentLength(req.headers["content-length"]);
    if (!contentLength.ok) {
      return res.status(contentLength.code === "pptx-total-too-large" ? 413 : 411).json({ error: contentLength.code });
    }
    const formData = await parseMultipartForm(req);
    const files = formData.getAll("files");
    const unit = typeof formData.get("unit") === "string" ? String(formData.get("unit")).trim() : "";
    const block = typeof formData.get("block") === "string" ? String(formData.get("block")).trim() : "";
    const remark = typeof formData.get("remark") === "string" ? String(formData.get("remark")).trim() : "";
    if (!unit) return res.status(400).json({ error: "unit is required" });
    if (!files.length) return res.status(400).json({ error: "No PPT/PPTX files uploaded" });
    const uploadLimit = validatePptxUploadLimits(files.filter((file): file is File => file instanceof File));
    if (!uploadLimit.ok) return res.status(413).json({ error: uploadLimit.code });

    await ensureUploadDirectories();
    const pending: Array<{ entry: File; wellNo: string; sourceOrder: number; sourceOriginalName: string; partOrder: number | null }> = [];
    const items: Array<Record<string, unknown>> = [];
    for (const [sourceOrder, entry] of files.entries()) {
      if (!(entry instanceof File)) { items.push({ fileName: "unknown", status: "invalid-file" }); continue; }
      const parsed = parseWellHistoryImportFileName(entry.name);
      const wellNo = normalizeWellHistoryWellNo(parsed.wellNo);
      const validation = validatePptxUploadFileName(entry.name);
      if (!wellNo) { items.push({ fileName: entry.name, wellNo: "", status: "invalid-name", message: "File name must match well number" }); continue; }
      if (!validation.ok) { items.push({ fileName: entry.name, wellNo, status: validation.code, message: "Only PPT/PPTX files are supported" }); continue; }
      pending.push({ entry, wellNo, sourceOrder, sourceOriginalName: entry.name, partOrder: parsed.order });
    }

    const { selected, superseded } = selectLatestWellHistoryImports(pending);
    for (const part of superseded) {
      items.push({ fileName: part.sourceOriginalName, wellNo: part.wellNo, status: "superseded", message: "已被同批次后续文件覆盖" });
    }

    for (const part of selected) {
      const { wellNo } = part;
      const extension = getFileExtension(part.sourceOriginalName);
      const sourceName = `${sanitizeFileSegment(wellNo, "well")}-part-${part.partOrder ?? part.sourceOrder + 1}-${Date.now()}-${randomUUID()}${extension}`;
      const sourcePath = path.join(WELL_HISTORY_SOURCE_UPLOAD_DIR, sourceName);
      const movedPagePaths: string[] = [];
      let pageDir: string | null = null;
      let saved = false;
      try {
        await fs.writeFile(sourcePath, Buffer.from(await part.entry.arrayBuffer()));
        pageDir = path.join(WELL_HISTORY_SOURCE_UPLOAD_DIR, `${sanitizeFileSegment(wellNo, "well")}-pages-${randomUUID()}`);
        const exportedPages = await exportPresentationSlidesWithPowerPoint(sourcePath, pageDir, extension);
        const pptxPath = extension === ".ppt"
          ? path.join(path.dirname(sourcePath), `${path.parse(sourcePath).name}.pptx`)
          : sourcePath;
        const pptxBuffer = await fs.readFile(pptxPath);
        const document = await parsePptxWellHistory(pptxBuffer);
        const pageUrls: string[] = [];
        for (const [index, pagePath] of exportedPages.entries()) {
          const pageName = `${sanitizeFileSegment(wellNo, "well")}-page-${index + 1}-${randomUUID()}.png`;
          const uploadPath = path.join(WELL_HISTORY_UPLOAD_DIR, pageName);
          await fs.rename(pagePath, uploadPath);
          movedPagePaths.push(uploadPath);
          pageUrls.push(`/uploads/well-history/${pageName}`);
        }
        const savedRecord = await saveWellHistoryPptxRecord({
          pptxBuffer,
          document,
          wellNo,
          unit,
          block: block || null,
          remark: remark || null,
          originalName: part.sourceOriginalName,
          sourceFormat: extension.slice(1),
          initialHtml: buildPptSlideHtml(pageUrls),
        });
        saved = true;
        items.push({ fileName: part.sourceOriginalName, wellNo, status: "success", pptxUrl: savedRecord.fileUrl, versionNo: savedRecord.versionNo, updatedAt: savedRecord.updatedAt });
      } catch (error: any) {
        items.push({ fileName: part.sourceOriginalName, wellNo, status: error?.code || "pptx-import-failed", message: error?.message || serializeError(error) });
      } finally {
        await cleanupWellHistoryPptImportArtifacts(pageDir, movedPagePaths, saved);
      }
    }
    const successCount = items.filter(item => item.status === "success").length;
    const supersededCount = items.filter(item => item.status === "superseded").length;
    res.json({ successCount, supersededCount, failureCount: items.length - successCount - supersededCount, items });
  } catch (error) {
    res.status(500).json({ error: "Well history PPT batch import failed", details: serializeError(error) });
  }
});

app.get("/api/well-history-archives/:wellNo/pptx", async (req, res) => {
  try {
    const wellNo = normalizeWellHistoryWellNo(req.params.wellNo ?? "");
    const archive = wellNo && await snapshotPrisma.wellHistoryArchive?.findUnique({ where: { wellNo }, include: { currentPptx: true } });
    if (!archive?.currentPptx) return res.status(404).json({ error: "Well history PPTX not found" });
    res.json(archive.currentPptx);
  } catch (error: any) { res.status(500).json({ error: error?.message || "Fetch well history PPTX failed" }); }
});

app.get("/api/well-history-archives/:wellNo/document", async (req, res) => {
  try {
    const wellNo = normalizeWellHistoryWellNo(req.params.wellNo ?? "");
    const document = wellNo && await snapshotPrisma.wellHistoryRichTextDocument?.findUnique({ where: { wellNo } });
    if (!document) return res.status(404).json({ error: "Well history rich text document not found" });
    res.json(document);
  } catch (error: any) { res.status(500).json({ error: error?.message || "Fetch well history document failed" }); }
});

app.put("/api/well-history-archives/:wellNo/document", async (req, res) => {
  try {
    const wellNo = normalizeWellHistoryWellNo(req.params.wellNo ?? "");
    const html = typeof req.body?.html === "string" ? sanitizeWellHistoryHtml(req.body.html) : "";
    if (!wellNo || !html) return res.status(400).json({ error: "wellNo and html are required" });
    const savedBy = typeof req.body?.savedBy === "string" ? req.body.savedBy.trim() || null : null;
    const saved = await prisma.$transaction(async (tx) => {
      const current = await tx.wellHistoryRichTextDocument.findUnique({ where: { wellNo } });
      if (!current) throw Object.assign(new Error("rich-text-not-found"), { code: "rich-text-not-found" });
      if (!Number.isInteger(req.body?.baseVersionNo) || req.body.baseVersionNo !== current.versionNo) throw Object.assign(new Error("rich-text-version-conflict"), { code: "rich-text-version-conflict" });
      const next = await tx.wellHistoryRichTextDocument.update({ where: { id: current.id }, data: { html, savedBy, versionNo: current.versionNo + 1 } });
      await tx.wellHistoryRichTextVersion.create({ data: { documentId: next.id, archiveId: next.archiveId, wellNo, html, versionNo: next.versionNo, savedBy } });
      return next;
    });
    res.json(saved);
  } catch (error: any) {
    if (error?.code === "rich-text-version-conflict") return res.status(409).json({ error: error.code });
    if (error?.code === "rich-text-not-found") return res.status(404).json({ error: error.code });
    res.status(500).json({ error: error?.message || "Save well history document failed" });
  }
});

app.get("/api/well-history-archives/:wellNo/pptx/versions", async (req, res) => {
  try {
    const wellNo = normalizeWellHistoryWellNo(req.params.wellNo ?? "");
    const archive = wellNo && await snapshotPrisma.wellHistoryArchive?.findUnique({ where: { wellNo }, select: { id: true } });
    if (!archive) return res.status(404).json({ error: "Well history archive not found" });
    const versions = await snapshotPrisma.wellHistoryPptxVersion?.findMany({ where: { archiveId: archive.id }, orderBy: { versionNo: "desc" } });
    res.json(versions ?? []);
  } catch (error: any) { res.status(500).json({ error: error?.message || "Fetch PPTX versions failed" }); }
});

app.post("/api/well-history-archives/:wellNo/pptx/versions", async (req, res) => {
  try {
    const wellNo = normalizeWellHistoryWellNo(req.params.wellNo ?? "");
    const validation = validatePptxVersionInput(req.body);
    if (!validation.ok) return res.status(400).json({ error: validation.code });
    if (!wellNo) return res.status(400).json({ error: "wellNo is required" });
    const document = toPptxDocument(req.body.document);
    const pptxBuffer = Buffer.from(await writePptxWellHistory(document));
    const storedFileName = `${sanitizeFileSegment(wellNo, "well")}-${Date.now()}-${randomUUID()}.pptx`;
    const fileUrl = `/uploads/well-history/${storedFileName}`;
    await fs.writeFile(path.join(WELL_HISTORY_UPLOAD_DIR, storedFileName), pptxBuffer);
    const savedBy = typeof req.body.savedBy === "string" ? req.body.savedBy.trim() || null : null;
    try {
      const saved = await prisma.$transaction(async (tx) => {
        const current = await tx.wellHistoryPptx.findUnique({ where: { wellNo } });
        if (!current) {
          const error = new Error("Well history PPTX not found");
          (error as Error & { code?: string }).code = "pptx-not-found";
          throw error;
        }
        const baseVersion = validatePptxBaseVersion(current.versionNo, req.body.baseVersionNo);
        if (!baseVersion.ok) {
          const error = new Error(baseVersion.code);
          (error as Error & { code?: string }).code = baseVersion.code;
          throw error;
        }
        const versionNo = current.versionNo + 1;
        const remark = typeof req.body.remark === "string" ? req.body.remark.trim() || null : current.remark;
        const data = { fileUrl, storedFileName, originalName: current.originalName, sourceFormat: "pptx", editorModelJson: serializablePptxDocument(document), versionNo, savedBy, remark };
        const pptx = await tx.wellHistoryPptx.update({ where: { id: current.id }, data });
        await tx.wellHistoryPptxVersion.create({ data: { ...data, pptxId: pptx.id, archiveId: pptx.archiveId, wellNo: pptx.wellNo } });
        await tx.wellHistoryArchive.update({ where: { id: pptx.archiveId }, data: { currentPptxId: pptx.id } });
        return pptx;
      });
      res.json(saved);
    } catch (error) { await removeWellHistoryUploadFile(fileUrl); throw error; }
  } catch (error: any) {
    if (error?.code === "pptx-version-conflict" || error?.code === "P2002") return res.status(409).json({ error: "pptx-version-conflict" });
    if (error?.code === "pptx-not-found") return res.status(404).json({ error: error.message });
    res.status(500).json({ error: error?.message || "Save PPTX version failed" });
  }
});

app.get("/api/well-history-archives/:wellNo/pptx/download", async (req, res) => {
  try {
    const wellNo = normalizeWellHistoryWellNo(req.params.wellNo ?? "");
    const current = wellNo && await snapshotPrisma.wellHistoryPptx?.findUnique({ where: { wellNo } });
    if (!current) return res.status(404).json({ error: "Well history PPTX not found" });
    const filePath = getWellHistoryUploadPath(current.fileUrl);
    if (!filePath) return res.status(404).json({ error: "Well history PPTX path is invalid" });
    res.download(filePath, current.originalName.endsWith(".pptx") ? current.originalName : `${current.originalName}.pptx`);
  } catch (error: any) { res.status(500).json({ error: error?.message || "Download PPTX failed" }); }
});

app.get("/api/well-history-archives", async (req, res) => {
  try {
    if (!snapshotPrisma.wellHistoryArchive) {
      return res.status(503).json({ error: "Well history archive table not available. Run prisma generate/db push first." });
    }

    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    const unit = typeof req.query.unit === "string" ? req.query.unit.trim() : "";
    const block = typeof req.query.block === "string" ? req.query.block.trim() : "";

    const where: any = {};
    if (unit) {
      where.unit = unit;
    }
    if (block) {
      where.block = block;
    }
    if (keyword) {
      where.OR = [
        { wellNo: { contains: keyword, mode: "insensitive" } },
        { displayName: { contains: keyword, mode: "insensitive" } },
      ];
    }

    const archives = await snapshotPrisma.wellHistoryArchive.findMany({
      where,
      include: {
        currentPdf: true,
        currentPptx: true,
      },
      orderBy: [
        { updatedAt: "desc" },
        { wellNo: "asc" },
      ],
    });

    res.json(archives);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Fetch well history archive directory failed" });
  }
});

app.get("/api/well-history-archives/search", async (req, res) => {
  try {
    if (!snapshotPrisma.wellHistoryArchive) {
      return res.status(503).json({ error: "Well history archive table not available. Run prisma generate/db push first." });
    }

    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    const unit = typeof req.query.unit === "string" ? req.query.unit.trim() : "";
    const block = typeof req.query.block === "string" ? req.query.block.trim() : "";

    const where = {
      AND: [
        unit ? { unit } : {},
        block ? { block } : {},
        keyword
          ? {
              OR: [
                { wellNo: { contains: keyword, mode: "insensitive" } },
                { displayName: { contains: keyword, mode: "insensitive" } },
                { remark: { contains: keyword, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    } as const;

    const rows = await snapshotPrisma.wellHistoryArchive.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: keyword ? 12 : 20,
      select: {
        id: true,
        wellNo: true,
        displayName: true,
        unit: true,
        block: true,
        remark: true,
        updatedAt: true,
      },
    });

    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Search well history archives failed" });
  }
});

app.delete("/api/well-history-archives/:wellNo", async (req, res) => {
  try {
    const requestedWellNo = typeof req.params.wellNo === "string" ? req.params.wellNo.trim() : "";
    if (!requestedWellNo) {
      return res.status(400).json({ error: "wellNo is required" });
    }

    await deleteWellHistoryArchiveByWellNo(requestedWellNo);
    res.json({ success: true, wellNo: normalizeWellHistoryWellNo(requestedWellNo) || requestedWellNo });
  } catch (error: any) {
    if (error?.message === "Well history archive not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error?.message || "Delete well history archive failed" });
  }
});

app.get("/api/well-history-archives/:wellNo", async (req, res) => {
  try {
    if (!snapshotPrisma.wellHistoryArchive) {
      return res.status(503).json({ error: "Well history archive table not available. Run prisma generate/db push first." });
    }

    const requestedWellNo = typeof req.params.wellNo === "string" ? req.params.wellNo.trim() : "";
    const normalizedWellNo = normalizeWellHistoryWellNo(requestedWellNo);
    if (!requestedWellNo) {
      return res.status(400).json({ error: "wellNo is required" });
    }

    let archive = await snapshotPrisma.wellHistoryArchive.findUnique({
      where: { wellNo: requestedWellNo },
      include: {
        currentPdf: true,
        currentPptx: true,
        extract: true,
      },
    });

    if (!archive && normalizedWellNo && normalizedWellNo !== requestedWellNo) {
      archive = await snapshotPrisma.wellHistoryArchive.findUnique({
        where: { wellNo: normalizedWellNo },
        include: {
          currentPdf: true,
          currentPptx: true,
          extract: true,
        },
      });
    }

    if (!archive) {
      return res.status(404).json({ error: "Well history archive not found" });
    }

    const needsRefresh =
      archive.currentPdf &&
      (!archive.extract ||
        archive.extract.pdfId !== archive.currentPdf.id ||
        archive.extract.title !== archive.wellNo ||
        new Date(archive.extract.updatedAt).getTime() < new Date(archive.currentPdf.updatedAt).getTime());

    if (needsRefresh && archive.currentPdf) {
      await syncWellHistoryArchive({
        id: archive.currentPdf.id,
        wellNo: archive.currentPdf.wellNo,
        unit: archive.currentPdf.unit,
        block: archive.currentPdf.block,
        originalName: archive.currentPdf.originalName,
        remark: archive.currentPdf.remark,
        fileUrl: archive.currentPdf.fileUrl,
      });

      archive = await snapshotPrisma.wellHistoryArchive.findUnique({
        where: { wellNo: archive.wellNo },
        include: {
          currentPdf: true,
          currentPptx: true,
          extract: true,
        },
      });
    }

    res.json(archive);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Fetch well history archive failed" });
  }
});

app.get("/api/well-history-archives-latest", async (req, res) => {
  try {
    if (!snapshotPrisma.wellHistoryArchive) {
      return res.status(503).json({ error: "Well history archive table not available. Run prisma generate/db push first." });
    }
    const archive = await snapshotPrisma.wellHistoryArchive.findFirst({
      where: { OR: [{ currentPdfId: { not: null } }, { currentPptxId: { not: null } }] },
      orderBy: { updatedAt: "desc" },
      include: { currentPdf: true, currentPptx: true, extract: true },
    });
    if (!archive) return res.status(404).json({ error: "Latest well history upload not found" });
    res.json(archive);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Fetch latest well history archive failed" });
  }
});

app.get("/api/well-history-archives/:wellNo/pdf-content", async (req, res) => {
  try {
    if (!snapshotPrisma.wellHistoryArchive) {
      return res.status(503).json({ error: "Well history archive table not available. Run prisma generate/db push first." });
    }

    const requestedWellNo = typeof req.params.wellNo === "string" ? req.params.wellNo.trim() : "";
    const normalizedWellNo = normalizeWellHistoryWellNo(requestedWellNo);
    if (!requestedWellNo) {
      return res.status(400).json({ error: "wellNo is required" });
    }

    let archive = await snapshotPrisma.wellHistoryArchive.findUnique({
      where: { wellNo: requestedWellNo },
      include: { currentPdf: true },
    });

    if (!archive && normalizedWellNo && normalizedWellNo !== requestedWellNo) {
      archive = await snapshotPrisma.wellHistoryArchive.findUnique({
        where: { wellNo: normalizedWellNo },
        include: { currentPdf: true },
      });
    }

    if (!archive?.currentPdf?.fileUrl) {
      return res.status(404).json({ error: "Well history PDF not found" });
    }

    const pdfPath = getWellHistoryUploadPath(archive.currentPdf.fileUrl);
    if (!pdfPath) {
      return res.status(404).json({ error: "Well history PDF path is invalid" });
    }

    const pdfBuffer = await fs.readFile(pdfPath);
    res.json({
      wellNo: archive.wellNo,
      fileUrl: archive.currentPdf.fileUrl,
      mimeType: archive.currentPdf.mimeType || PDF_MIME_TYPE,
      size: pdfBuffer.byteLength,
      base64: pdfBuffer.toString("base64"),
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Fetch well history PDF content failed" });
  }
});

app.get("/api/well-history-archives/:wellNo/pdf-overlay", async (req, res) => {
  try {
    if (!snapshotPrisma.wellHistoryArchive || !snapshotPrisma.wellHistoryPdfOverlay) {
      return res.status(503).json({ error: "Well history overlay table not available. Run prisma generate/db push first." });
    }

    const requestedWellNo = typeof req.params.wellNo === "string" ? req.params.wellNo.trim() : "";
    const normalizedWellNo = normalizeWellHistoryWellNo(requestedWellNo);
    const wellNo = normalizedWellNo || requestedWellNo;

    if (!wellNo) {
      return res.status(400).json({ error: "wellNo is required" });
    }

    const archive = await snapshotPrisma.wellHistoryArchive.findUnique({
      where: { wellNo },
      include: { currentPdf: true },
    });

    if (!archive?.currentPdf?.id) {
      return res.status(404).json({ error: "Well history PDF not found" });
    }

    const overlay = await snapshotPrisma.wellHistoryPdfOverlay.findUnique({
      where: {
        wellNo_pdfId: {
          wellNo,
          pdfId: archive.currentPdf.id,
        },
      },
    });

    res.json({
      wellNo,
      pdfId: archive.currentPdf.id,
      elementsJson: overlay?.elementsJson ?? { version: 1, elements: [] },
      updatedAt: overlay?.updatedAt ?? null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Fetch well history PDF overlay failed" });
  }
});

app.post("/api/well-history-archives/:wellNo/pdf-overlay", async (req, res) => {
  try {
    if (!snapshotPrisma.wellHistoryArchive || !snapshotPrisma.wellHistoryPdfOverlay) {
      return res.status(503).json({ error: "Well history overlay table not available. Run prisma generate/db push first." });
    }

    const requestedWellNo = typeof req.params.wellNo === "string" ? req.params.wellNo.trim() : "";
    const normalizedWellNo = normalizeWellHistoryWellNo(requestedWellNo);
    const wellNo = normalizedWellNo || requestedWellNo;
    const body = (req.body ?? {}) as Partial<WellHistoryOverlayPayload>;

    if (!wellNo) {
      return res.status(400).json({ error: "wellNo is required" });
    }

    if (!body.pdfId || !body.elementsJson || !Array.isArray(body.elementsJson.elements)) {
      return res.status(400).json({ error: "pdfId and elementsJson are required" });
    }

    const archive = await snapshotPrisma.wellHistoryArchive.findUnique({
      where: { wellNo },
      include: { currentPdf: true },
    });

    if (!archive?.currentPdf?.id) {
      return res.status(404).json({ error: "Well history PDF not found" });
    }

    if (body.pdfId !== archive.currentPdf.id) {
      return res.status(400).json({ error: "pdfId does not match the current well history PDF" });
    }

    const saved = await snapshotPrisma.wellHistoryPdfOverlay.upsert({
      where: {
        wellNo_pdfId: {
          wellNo,
          pdfId: body.pdfId,
        },
      },
      create: {
        wellNo,
        pdfId: body.pdfId,
        elementsJson: body.elementsJson as Prisma.InputJsonValue,
      },
      update: {
        elementsJson: body.elementsJson as Prisma.InputJsonValue,
      },
    });

    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Save well history PDF overlay failed" });
  }
});

// 7. Business Module APIs
app.get("/api/water-cuts", async (req, res) => {
  try {
    const { page, pageSize, skip, take } = normalizePagination(req.query);
    const where = buildWaterCutWhere(req.query as Record<string, unknown>);
    const [rows, total] = await Promise.all([
      prisma.waterCutRecord.findMany({ where, orderBy: [{ createdAt: "desc" }, { sampleDate: "desc" }, { wellNo: "asc" }], skip, take }),
      prisma.waterCutRecord.count({ where }),
    ]);
    res.json(paginatedResponse(rows, total, page, pageSize));
  } catch (error) {
    res.status(500).json({ error: "Water cut records query failed", details: serializeError(error) });
  }
});

app.post("/api/water-cuts", async (req, res) => {
  try {
    const data = normalizeWaterCutPayload(req.body);
    if (!data.unit || !data.block || !data.wellNo || !data.sampleDate || data.waterCut === null || !data.tester) {
      return res.status(400).json({ error: "Water cut record is missing required fields" });
    }
    const sampleDate = parseStrictDate(data.sampleDate);
    if (!sampleDate) {
      return res.status(400).json({ error: "Water cut record has an invalid sampleDate" });
    }
    const record = await prisma.waterCutRecord.create({
      data: { ...data, sampleDate, waterCut: data.waterCut },
    });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Water cut record create failed", details: serializeError(error) });
  }
});

app.post("/api/water-cuts/import", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) {
      return res.status(400).json({ error: "No water cut rows to import" });
    }

    const data = rows.map((row, index) => {
      const normalized = normalizeWaterCutPayload(row);
      if (!normalized.unit || !normalized.block || !normalized.wellNo || !normalized.sampleDate || normalized.waterCut === null || !normalized.tester) {
        throw new Error(`第 ${index + 1} 行缺少单位、区块、井号、日期、含水或化验员`);
      }
      const sampleDate = parseStrictDate(normalized.sampleDate);
      if (!sampleDate) {
        throw new Error(`第 ${index + 1} 行日期格式无效`);
      }
      return {
        ...normalized,
        sampleDate,
        waterCut: normalized.waterCut,
      };
    });

    await prisma.waterCutRecord.createMany({ data });
    res.status(201).json({ imported: data.length });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || "Water cut records import failed" });
  }
});

app.delete("/api/water-cuts/:id", async (req, res) => {
  try {
    await prisma.waterCutRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Water cut record not found" });
  }
});

app.get("/api/injection-tech-records", async (req, res) => {
  try {
    const { page, pageSize, skip, take } = normalizePagination(req.query);
    const where = buildInjectionTechWhere(req.query as Record<string, unknown>);
    const [rows, total] = await Promise.all([
      prisma.injectionTechRecord.findMany({ where, orderBy: [{ createdAt: "desc" }, { runningDate: "desc" }, { wellNo: "asc" }], skip, take }),
      prisma.injectionTechRecord.count({ where }),
    ]);
    res.json(paginatedResponse(rows, total, page, pageSize));
  } catch (error) {
    res.status(500).json({ error: "Injection tech records query failed", details: serializeError(error) });
  }
});

app.post("/api/injection-tech-records", async (req, res) => {
  try {
    const data = normalizeInjectionTechPayload(req.body);
    if (
      !data.wellNo ||
      !data.block ||
      !data.workArea ||
      !data.process ||
      data.packerCount === null ||
      !data.bottomStructure ||
      !data.washable ||
      !data.doublePacker ||
      !data.lastWorkDate ||
      !data.runningDate
    ) {
      return res.status(400).json({ error: "Injection tech record is missing required fields" });
    }
    const lastWorkDate = parseStrictDate(data.lastWorkDate);
    const runningDate = parseStrictDate(data.runningDate);
    if (!lastWorkDate || !runningDate) {
      return res.status(400).json({ error: "Injection tech record has invalid date fields" });
    }
    const record = await prisma.injectionTechRecord.create({
      data: {
        ...data,
        packerCount: data.packerCount,
        packerModels: data.packerModels,
        lastWorkDate,
        runningDate,
      },
    });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Injection tech record create failed", details: serializeError(error) });
  }
});

app.delete("/api/injection-tech-records/:id", async (req, res) => {
  try {
    await prisma.injectionTechRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Injection tech record not found" });
  }
});

app.get("/api/well-flushing-records", async (req, res) => {
  try {
    const { page, pageSize, skip, take } = normalizePagination(req.query);
    const where = buildWellFlushingWhere(req.query as Record<string, unknown>);
    const [rows, total] = await Promise.all([
      prisma.wellFlushingRecord.findMany({ where, orderBy: [{ createdAt: "desc" }, { washDate: "desc" }, { wellNo: "asc" }], skip, take }),
      prisma.wellFlushingRecord.count({ where }),
    ]);
    res.json(paginatedResponse(rows, total, page, pageSize));
  } catch (error) {
    res.status(500).json({ error: "Well flushing records query failed", details: serializeError(error) });
  }
});

app.post("/api/well-flushing-records", async (req, res) => {
  try {
    const data = normalizeWellFlushingPayload(req.body);
    if (!data.unit || !data.wellNo || !data.washDate || data.daysSinceLastWash === null || !data.method) {
      return res.status(400).json({ error: "Well flushing record is missing required fields" });
    }
    const washDate = parseStrictDate(data.washDate);
    if (!washDate) {
      return res.status(400).json({ error: "Well flushing record has an invalid washDate" });
    }
    const record = await prisma.wellFlushingRecord.create({
      data: {
        ...data,
        washDate,
        daysSinceLastWash: data.daysSinceLastWash,
        firstLevel: data.firstLevel,
        secondLevel: data.secondLevel,
        suspendedMatter: data.suspendedMatter,
      },
    });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Well flushing record create failed", details: serializeError(error) });
  }
});

app.post("/api/well-flushing-records/import", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) {
      return res.status(400).json({ error: "No well flushing rows to import" });
    }

    const data = rows.map((row, index) => {
      const normalized = normalizeWellFlushingPayload(row);
      if (!normalized.unit || !normalized.wellNo || !normalized.washDate || !normalized.method) {
        throw new Error(`第 ${index + 1} 行缺少单位、井号、洗井日期或洗井方式`);
      }
      const washDate = parseStrictDate(normalized.washDate);
      if (!washDate) {
        throw new Error(`第 ${index + 1} 行洗井日期格式无效`);
      }
      return {
        ...normalized,
        washDate,
        daysSinceLastWash: normalized.daysSinceLastWash,
        firstLevel: normalized.firstLevel,
        secondLevel: normalized.secondLevel,
        suspendedMatter: normalized.suspendedMatter,
      };
    });

    await prisma.wellFlushingRecord.createMany({ data });
    res.status(201).json({ imported: data.length });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || "Well flushing records import failed" });
  }
});

app.delete("/api/well-flushing-records/:id", async (req, res) => {
  try {
    await prisma.wellFlushingRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Well flushing record not found" });
  }
});

app.get("/api/abnormal-well-records", async (req, res) => {
  try {
    const { page, pageSize, skip, take } = normalizePagination(req.query);
    const where = buildAbnormalWellWhere(req.query as Record<string, unknown>);
    const [rows, total] = await Promise.all([
      prisma.abnormalWellRecord.findMany({ where, orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }, { wellNo: "asc" }], skip, take }),
      prisma.abnormalWellRecord.count({ where }),
    ]);
    res.json(paginatedResponse(rows, total, page, pageSize));
  } catch (error) {
    res.status(500).json({ error: "Abnormal well records query failed", details: serializeError(error) });
  }
});

app.post("/api/abnormal-well-records", async (req, res) => {
  try {
    const data = normalizeAbnormalWellPayload(req.body);
    if (!data.category || !data.wellNo || !data.block || !data.unit || !data.process) {
      return res.status(400).json({ error: "Abnormal well record is missing required fields" });
    }
    const record = await prisma.abnormalWellRecord.create({ data });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Abnormal well record create failed", details: serializeError(error) });
  }
});

app.delete("/api/abnormal-well-records/:id", async (req, res) => {
  try {
    await prisma.abnormalWellRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Abnormal well record not found" });
  }
});

const toStringArray = (value: unknown, length: number, fallback = "-") => {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, index) => trimText(source[index]) || fallback);
};

app.get("/api/concentric-test-records", async (req, res) => {
  try {
    const { page, pageSize, skip, take } = normalizePagination(req.query);
    const where = buildConcentricTestWhere(req.query as Record<string, unknown>);
    const [rows, total] = await Promise.all([
      prisma.concentricTestRecord.findMany({ where, orderBy: [{ createdAt: "desc" }, { testDate: "desc" }, { wellNo: "asc" }], skip, take }),
      prisma.concentricTestRecord.count({ where }),
    ]);
    res.json(paginatedResponse(rows, total, page, pageSize));
  } catch (error) {
    res.status(500).json({ error: "Concentric test records query failed", details: serializeError(error) });
  }
});

app.post("/api/concentric-test-records", async (req, res) => {
  try {
    const data = normalizeConcentricTestPayload(req.body);
    const testDate = parseStrictDate(data.testDate);
    if (!data.wellNo || !testDate || !Number.isFinite(data.allocatorCount)) {
      return res.status(400).json({ error: "Concentric test record is missing required fields" });
    }
    const record = await prisma.concentricTestRecord.create({ data: { ...data, testDate } });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Concentric test record create failed", details: serializeError(error) });
  }
});

app.delete("/api/concentric-test-records/:id", async (req, res) => {
  try {
    await prisma.concentricTestRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Concentric test record not found" });
  }
});

app.get("/api/smart-test-records", async (req, res) => {
  try {
    const { page, pageSize, skip, take } = normalizePagination(req.query);
    const where = buildConcentricTestWhere(req.query as Record<string, unknown>);
    const [rows, total] = await Promise.all([
      prisma.smartTestRecord.findMany({ where, orderBy: [{ createdAt: "desc" }, { testDate: "desc" }, { wellNo: "asc" }], skip, take }),
      prisma.smartTestRecord.count({ where }),
    ]);
    res.json(paginatedResponse(rows, total, page, pageSize));
  } catch (error) {
    res.status(500).json({ error: "Smart test records query failed", details: serializeError(error) });
  }
});

app.post("/api/smart-test-records", async (req, res) => {
  try {
    const data = normalizeSmartTestPayload(req.body);
    const testDate = parseStrictDate(data.testDate);
    if (!data.wellNo || !testDate || !Number.isFinite(data.allocatorCount)) {
      return res.status(400).json({ error: "Smart test record is missing required fields" });
    }
    const record = await prisma.smartTestRecord.create({ data: { ...data, testDate } });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Smart test record create failed", details: serializeError(error) });
  }
});

app.delete("/api/smart-test-records/:id", async (req, res) => {
  try {
    await prisma.smartTestRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Smart test record not found" });
  }
});

app.get("/api/single-well-injection-evaluations", async (req, res) => {
  try {
    const { page, pageSize, skip, take } = normalizePagination(req.query);
    const where = buildSingleWellEvaluationWhere(req.query as Record<string, unknown>);
    const [rows, total] = await Promise.all([
      prisma.singleWellInjectionEvaluationRecord.findMany({ where, orderBy: [{ createdAt: "desc" }, { evaluationDate: "desc" }, { wellNo: "asc" }], skip, take }),
      prisma.singleWellInjectionEvaluationRecord.count({ where }),
    ]);
    res.json(paginatedResponse(rows, total, page, pageSize));
  } catch (error) {
    res.status(500).json({ error: "Single well injection evaluations query failed", details: serializeError(error) });
  }
});

app.post("/api/single-well-injection-evaluations", async (req, res) => {
  try {
    const data = normalizeSingleWellInjectionEvaluationPayload(req.body);
    const evaluationDate = parseStrictDate(data.evaluationDate);
    if (!data.wellNo || !data.process || !data.unit || !evaluationDate) {
      return res.status(400).json({ error: "Single well injection evaluation is missing required fields" });
    }
    const record = await prisma.singleWellInjectionEvaluationRecord.create({ data: { ...data, evaluationDate } });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Single well injection evaluation create failed", details: serializeError(error) });
  }
});

app.delete("/api/single-well-injection-evaluations/:id", async (req, res) => {
  try {
    await prisma.singleWellInjectionEvaluationRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Single well injection evaluation not found" });
  }
});

app.get("/api/single-well-seal-evaluations", async (req, res) => {
  try {
    const { page, pageSize, skip, take } = normalizePagination(req.query);
    const where = buildSingleWellEvaluationWhere(req.query as Record<string, unknown>);
    const [rows, total] = await Promise.all([
      prisma.singleWellSealEvaluationRecord.findMany({ where, orderBy: [{ createdAt: "desc" }, { evaluationDate: "desc" }, { wellNo: "asc" }], skip, take }),
      prisma.singleWellSealEvaluationRecord.count({ where }),
    ]);
    res.json(paginatedResponse(rows, total, page, pageSize));
  } catch (error) {
    res.status(500).json({ error: "Single well seal evaluations query failed", details: serializeError(error) });
  }
});

app.post("/api/single-well-seal-evaluations", async (req, res) => {
  try {
    const data = normalizeSingleWellSealEvaluationPayload(req.body);
    const evaluationDate = parseStrictDate(data.evaluationDate);
    if (!data.wellNo || !data.process || !evaluationDate) {
      return res.status(400).json({ error: "Single well seal evaluation is missing required fields" });
    }
    const record = await prisma.singleWellSealEvaluationRecord.create({ data: { ...data, evaluationDate } });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Single well seal evaluation create failed", details: serializeError(error) });
  }
});

app.delete("/api/single-well-seal-evaluations/:id", async (req, res) => {
  try {
    await prisma.singleWellSealEvaluationRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Single well seal evaluation not found" });
  }
});

app.get("/api/zonal-indicator-summaries", async (req, res) => {
  try {
    const where = buildZonalIndicatorSummaryWhere(req.query as Record<string, unknown>);
    const rows = await prisma.zonalIndicatorSummaryRecord.findMany({ where, orderBy: [{ createdAt: "desc" }, { sortOrder: "asc" }] });
    res.json({ rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ error: "Zonal indicator summaries query failed", details: serializeError(error) });
  }
});

app.post("/api/zonal-indicator-summaries", async (req, res) => {
  try {
    const data = {
      category: trimText(req.body.category),
      process: trimText(req.body.process),
      wellCount: Number(req.body.wellCount),
      processRate: trimText(req.body.processRate),
      intervalCount: Number(req.body.intervalCount),
      actualCount: Number(req.body.actualCount),
      level: trimText(req.body.level),
      segmentSeal: toStringArray(req.body.segmentSeal, 5, "0"),
      fullSeal: toStringArray(req.body.fullSeal, 4, "0"),
      allocation: toStringArray(req.body.allocation, 5, "0"),
      sortOrder: Number(req.body.sortOrder ?? 0),
    };
    if (!data.category || !data.process || !Number.isFinite(data.wellCount)) {
      return res.status(400).json({ error: "Zonal indicator summary is missing required fields" });
    }
    const record = await prisma.zonalIndicatorSummaryRecord.create({ data });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Zonal indicator summary create failed", details: serializeError(error) });
  }
});

app.delete("/api/zonal-indicator-summaries/:id", async (req, res) => {
  try {
    await prisma.zonalIndicatorSummaryRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Zonal indicator summary not found" });
  }
});

app.get("/api/indicator-curve-records", async (req, res) => {
  try {
    const { page, pageSize, skip, take } = normalizePagination(req.query);
    const where = buildIndicatorCurveWhere(req.query as Record<string, unknown>);
    const [rows, total] = await Promise.all([
      prisma.indicatorCurveRecord.findMany({ where, orderBy: [{ createdAt: "desc" }, { wellNo: "asc" }, { testDate: "desc" }], skip, take }),
      prisma.indicatorCurveRecord.count({ where }),
    ]);
    res.json(paginatedResponse(rows, total, page, pageSize));
  } catch (error) {
    res.status(500).json({ error: "Indicator curve records query failed", details: serializeError(error) });
  }
});

app.post("/api/indicator-curve-records", async (req, res) => {
  try {
    const testDate = parseStrictDate(trimText(req.body.testDate));
    const data = {
      unit: trimText(req.body.unit),
      block: trimText(req.body.block),
      wellNo: trimText(req.body.wellNo),
      testDate,
      testInterval: trimText(req.body.testInterval),
      injection1: Number(req.body.injection1),
      pressure1: Number(req.body.pressure1),
      injection2: Number(req.body.injection2),
      pressure2: Number(req.body.pressure2),
      injection3: Number(req.body.injection3),
      pressure3: Number(req.body.pressure3),
      injection4: Number(req.body.injection4),
      pressure4: Number(req.body.pressure4),
      injection5: Number(req.body.injection5),
      pressure5: Number(req.body.pressure5),
    };
    const numericValues = [
      data.injection1,
      data.pressure1,
      data.injection2,
      data.pressure2,
      data.injection3,
      data.pressure3,
      data.injection4,
      data.pressure4,
      data.injection5,
      data.pressure5,
    ];
    if (!data.unit || !data.block || !data.wellNo || !data.testDate || !data.testInterval || numericValues.some((value) => !Number.isFinite(value))) {
      return res.status(400).json({ error: "指示曲线记录缺少必填字段或数值格式不正确" });
    }
    const record = await prisma.indicatorCurveRecord.create({ data: data as any });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "指示曲线记录新增失败", details: serializeError(error) });
  }
});

app.post("/api/indicator-curve-records/import", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) {
      return res.status(400).json({ error: "没有可导入的指示曲线数据" });
    }

    const data = rows.map((row, index) => {
      const testDate = parseStrictDate(trimText(row.testDate));
      const normalized = {
        unit: trimText(row.unit),
        block: trimText(row.block),
        wellNo: trimText(row.wellNo),
        testDate,
        testInterval: trimText(row.testInterval),
        injection1: Number(row.injection1),
        pressure1: Number(row.pressure1),
        injection2: Number(row.injection2),
        pressure2: Number(row.pressure2),
        injection3: Number(row.injection3),
        pressure3: Number(row.pressure3),
        injection4: Number(row.injection4),
        pressure4: Number(row.pressure4),
        injection5: Number(row.injection5),
        pressure5: Number(row.pressure5),
      };
      const numericValues = [
        normalized.injection1,
        normalized.pressure1,
        normalized.injection2,
        normalized.pressure2,
        normalized.injection3,
        normalized.pressure3,
        normalized.injection4,
        normalized.pressure4,
        normalized.injection5,
        normalized.pressure5,
      ];
      if (!normalized.unit || !normalized.block || !normalized.wellNo || !normalized.testDate || !normalized.testInterval || numericValues.some((value) => !Number.isFinite(value))) {
        throw new Error(`第 ${index + 1} 行缺少必填字段或日注/压力不是有效数字`);
      }
      return normalized;
    });

    const result = await prisma.indicatorCurveRecord.createMany({ data, skipDuplicates: true });
    res.status(201).json({ imported: result.count, skipped: data.length - result.count });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || "指示曲线 Excel 导入失败" });
  }
});

app.delete("/api/indicator-curve-records/:id", async (req, res) => {
  try {
    await prisma.indicatorCurveRecord.delete({ where: { id: String(req.params.id) } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Indicator curve record not found" });
  }
});

app.get("/api/dynamic-analysis-records", async (req, res) => {
  try {
    const { page, pageSize, skip, take } = normalizePagination(req.query);
    const where = buildDynamicAnalysisWhere(req.query as Record<string, unknown>);
    const hasDiffThresholds = ["liquidDiffMin", "oilDiffMin", "waterDiffMin", "injectionDiffMin"].some((key) => trimText(req.query[key]).length > 0);
    if (hasDiffThresholds) {
      const allRows = await prisma.dynamicAnalysisRecord.findMany({ where, orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }, { block: "asc" }, { wellNo: "asc" }] });
      const filteredRows = filterDynamicAnalysisRowsByDiffThresholds(allRows, req.query as Record<string, unknown>);
      res.json(paginatedResponse(filteredRows.slice(skip, skip + take), filteredRows.length, page, pageSize));
      return;
    }
    const [rows, total] = await Promise.all([
      prisma.dynamicAnalysisRecord.findMany({ where, orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }, { block: "asc" }, { wellNo: "asc" }], skip, take }),
      prisma.dynamicAnalysisRecord.count({ where }),
    ]);
    res.json(paginatedResponse(rows, total, page, pageSize));
  } catch (error) {
    res.status(500).json({ error: "Dynamic analysis records query failed", details: serializeError(error) });
  }
});

app.post("/api/dynamic-analysis-records", async (req, res) => {
  try {
    const data = {
      kind: trimText(req.body.kind),
      unit: trimText(req.body.unit),
      block: trimText(req.body.block),
      wellNo: toNullableText(req.body.wellNo),
      endValues: toStringArray(req.body.endValues, req.body.kind === "overall-water" || req.body.kind === "single-water" ? 3 : 5, "0"),
      averageValues: toStringArray(req.body.averageValues, req.body.kind === "overall-water" || req.body.kind === "single-water" ? 3 : 5, "0"),
      lastYearValues: toStringArray(req.body.lastYearValues, req.body.kind === "overall-water" || req.body.kind === "single-water" ? 3 : 5, "0"),
      diffMonth: toStringArray(req.body.diffMonth, req.body.kind === "overall-water" || req.body.kind === "single-water" ? 3 : 5, "0"),
      diffYear: toStringArray(req.body.diffYear, req.body.kind === "overall-water" || req.body.kind === "single-water" ? 3 : 5, "0"),
      advice: toStringArray(req.body.advice, 2, ""),
      status: toNullableText(req.body.status),
      process: toNullableText(req.body.process),
    };
    if (!data.kind || !data.unit || !data.block) {
      return res.status(400).json({ error: "Dynamic analysis record is missing required fields" });
    }
    const record = await prisma.dynamicAnalysisRecord.create({ data });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Dynamic analysis record create failed", details: serializeError(error) });
  }
});

app.delete("/api/dynamic-analysis-records/:id", async (req, res) => {
  try {
    await prisma.dynamicAnalysisRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Dynamic analysis record not found" });
  }
});

app.get("/api/well-measures", async (req, res) => {
  const data = await prisma.wellMeasure.findMany({ include: { well: true } });
  res.json(data);
});

app.get("/api/dynamic-adjustments", async (req, res) => {
  try {
    const { adjustmentWaterWell, trackedOilWell, adjustmentPurpose, fromDate, toDate } = req.query;
    const where: Record<string, unknown> = {};

    if (typeof adjustmentWaterWell === "string" && adjustmentWaterWell.trim()) {
      where.adjustmentWaterWell = { contains: adjustmentWaterWell.trim(), mode: "insensitive" };
    }
    if (typeof trackedOilWell === "string" && trackedOilWell.trim()) {
      where.trackedOilWell = { contains: trackedOilWell.trim(), mode: "insensitive" };
    }
    if (typeof adjustmentPurpose === "string" && adjustmentPurpose.trim()) {
      where.adjustmentPurpose = adjustmentPurpose.trim();
    }
    if (
      (typeof fromDate === "string" && fromDate.trim()) ||
      (typeof toDate === "string" && toDate.trim())
    ) {
      where.adjustmentDate = {
        ...(typeof fromDate === "string" && fromDate.trim() ? { gte: new Date(`${fromDate.trim()}T00:00:00.000Z`) } : {}),
        ...(typeof toDate === "string" && toDate.trim() ? { lte: new Date(`${toDate.trim()}T00:00:00.000Z`) } : {}),
      };
    }

    const records = await snapshotPrisma.dynamicAdjustmentRecord.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { adjustmentDate: "desc" }, { updatedAt: "desc" }],
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "动态调配记录查询失败", details: serializeError(error) });
  }
});

app.post("/api/dynamic-adjustments", async (req, res) => {
  try {
    const parsed = DynamicAdjustmentRequestSchema.parse(req.body);
    const data = normalizeDynamicAdjustmentPayload(parsed);
    const adjustmentDate = parseStrictDate(data.adjustmentDate);
    if (!adjustmentDate) {
      return res.status(400).json({ error: "Dynamic adjustment record has an invalid adjustmentDate" });
    }
    const record = await snapshotPrisma.dynamicAdjustmentRecord.create({
      data: {
        ...data,
        adjustmentDate,
        stageDays: data.stageDays === null ? null : Math.trunc(data.stageDays),
      },
    });
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ errors: error.issues });
    res.status(500).json({ error: "动态调配记录新增失败", details: serializeError(error) });
  }
});

app.put("/api/dynamic-adjustments/:id", async (req, res) => {
  try {
    const parsed = DynamicAdjustmentRequestSchema.parse(req.body);
    const data = normalizeDynamicAdjustmentPayload(parsed);
    const adjustmentDate = parseStrictDate(data.adjustmentDate);
    if (!adjustmentDate) {
      return res.status(400).json({ error: "Dynamic adjustment record has an invalid adjustmentDate" });
    }
    const record = await snapshotPrisma.dynamicAdjustmentRecord.update({
      where: { id: req.params.id },
      data: {
        ...data,
        adjustmentDate,
        stageDays: data.stageDays === null ? null : Math.trunc(data.stageDays),
      },
    });
    res.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ errors: error.issues });
    res.status(500).json({ error: "动态调配记录更新失败", details: serializeError(error) });
  }
});

app.delete("/api/dynamic-adjustments/:id", async (req, res) => {
  try {
    await snapshotPrisma.dynamicAdjustmentRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ error: "Dynamic adjustment record not found" });
    }
    res.status(500).json({ error: "动态调配记录删除失败", details: serializeError(error) });
  }
});

app.get("/api/adjustments", async (req, res) => {
  const data = await prisma.adjustmentRecord.findMany();
  res.json(data);
});

app.get("/api/home-overview", async (req, res) => {
  try {
    const requestedUnit = typeof req.query.unit === "string" ? req.query.unit : undefined;
    const overview = await fetchHomeOverview(requestedUnit);
    res.json(overview);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Home overview failed" });
  }
});

app.get("/api/home-reserve-overview", async (_req, res) => {
  try {
    if (!snapshotPrisma.homeReserveOverviewRecord) {
      throw new Error("Home reserve overview table not available");
    }
    const records = await snapshotPrisma.homeReserveOverviewRecord.findMany({
      orderBy: [{ sortOrder: "asc" }, { unit: "asc" }, { block: "asc" }],
    });
    res.json({ rows: buildHomeReserveOverviewRows(records) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Home reserve overview failed" });
  }
});

app.get("/api/pressure-data/:wellId", async (req, res) => {
  const data = await prisma.pressureData.findMany({
    where: { wellId: req.params.wellId },
    orderBy: { date: 'asc' }
  });
  res.json(data);
});

app.get("/api/production/validate", async (req, res) => {
  try {
    const unit = ProductionUnitSchema.parse(req.query.unit);
    const validation = hasOracleConfig()
      ? await fetchProductionValidation(unit)
      : await fetchProductionValidationFromHistory(unit);
    res.json(validation);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid unit", details: error.issues });
    }
    res.status(500).json({ error: error?.message || "Production validation failed" });
  }
});

app.get("/api/production/summary", async (req, res) => {
  try {
    const unit = ProductionUnitSchema.parse(req.query.unit);
    const validation = hasOracleConfig()
      ? await fetchProductionValidation(unit)
      : await fetchProductionValidationFromHistory(unit);
    res.json({
      unit: validation.unit,
      oracleScope: validation.oracleScope,
      summary: validation.summary,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid unit", details: error.issues });
    }
    res.status(500).json({ error: error?.message || "Production summary failed" });
  }
});

app.get("/api/production/wells", async (req, res) => {
  try {
    const unit = ProductionUnitSchema.parse(req.query.unit);
    const snapshot = await getProductionSnapshotResponse(unit);
    if (snapshot) {
      return res.json(snapshot);
    }

    const validation = await fetchProductionValidation(unit);
    res.json({
      unit: validation.unit,
      oracleScope: validation.oracleScope,
      rows: validation.sampleRows,
      meta: {
        source: LIVE_SOURCE,
        lastRefreshedAt: null,
        refreshInProgress: activeRefreshJobs.has(PRODUCTION_SNAPSHOT_DATASET),
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid unit", details: error.issues });
    }
    res.status(500).json({ error: error?.message || "Production wells failed" });
  }
});

app.get("/api/water-production/validate", async (req, res) => {
  try {
    const { unit, startDate } = WaterProductionQuerySchema.parse(req.query);
    const validation = hasOracleConfig()
      ? await fetchWaterWellValidation(unit, startDate)
      : await fetchWaterWellValidationFromHistory(unit, startDate);
    res.json(validation);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid water production query", details: error.issues });
    }
    res.status(500).json({ error: error?.message || "Water production validation failed" });
  }
});

app.get("/api/water-production/summary", async (req, res) => {
  try {
    const { unit, startDate } = WaterProductionQuerySchema.parse(req.query);
    const validation = hasOracleConfig()
      ? await fetchWaterWellValidation(unit, startDate)
      : await fetchWaterWellValidationFromHistory(unit, startDate);
    res.json({
      unit: validation.unit,
      oracleScope: validation.oracleScope,
      startDate: validation.startDate,
      summary: validation.summary,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid water production query", details: error.issues });
    }
    res.status(500).json({ error: error?.message || "Water production summary failed" });
  }
});

app.get("/api/water-production/daily", async (req, res) => {
  try {
    const { unit, startDate } = WaterProductionQuerySchema.parse(req.query);
    const validation = hasOracleConfig()
      ? await fetchWaterWellValidation(unit, startDate)
      : await fetchWaterWellValidationFromHistory(unit, startDate);
    res.json({
      unit: validation.unit,
      oracleScope: validation.oracleScope,
      startDate: validation.startDate,
      rows: validation.sampleRows,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid water production query", details: error.issues });
    }
    res.status(500).json({ error: error?.message || "Water production daily rows failed" });
  }
});

app.get("/api/water-production/comparison", async (req, res) => {
  try {
    const { unit, startDate } = WaterProductionQuerySchema.parse(req.query);
    const snapshot = await getWaterSnapshotResponse(unit, startDate);
    if (snapshot) {
      return res.json(snapshot);
    }

    const comparison = await fetchWaterProductionComparison(unit, startDate);
    res.json({
      ...comparison,
      meta: {
        source: LIVE_SOURCE,
        lastRefreshedAt: null,
        refreshInProgress: activeRefreshJobs.has(WATER_SNAPSHOT_DATASET),
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid water production comparison query", details: error.issues });
    }
    res.status(500).json({ error: error?.message || "Water production comparison failed" });
  }
});

app.get("/api/oracle-snapshots/status", async (req, res) => {
  try {
    const [production, water] = await Promise.all([
      getLatestBatchStatus(PRODUCTION_SNAPSHOT_DATASET),
      getLatestBatchStatus(WATER_SNAPSHOT_DATASET),
    ]);
    res.json({
      production,
      water,
      refreshInProgress: {
        production: activeRefreshJobs.has(PRODUCTION_SNAPSHOT_DATASET),
        water: activeRefreshJobs.has(WATER_SNAPSHOT_DATASET),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Snapshot status failed" });
  }
});

app.post("/api/oracle-snapshots/refresh", async (req, res) => {
  const datasetSchema = z.object({
    dataset: z.enum([PRODUCTION_SNAPSHOT_DATASET, WATER_SNAPSHOT_DATASET, "all"]).default("all"),
  });

  try {
    const { dataset } = datasetSchema.parse(req.body ?? {});
    if (dataset === "all") {
      await Promise.all([
        runRefreshJob(PRODUCTION_SNAPSHOT_DATASET, "manual"),
        runRefreshJob(WATER_SNAPSHOT_DATASET, "manual"),
      ]);
    } else {
      await runRefreshJob(dataset, "manual");
    }
    res.json({ ok: true, dataset });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid refresh request", details: error.issues });
    }
    res.status(500).json({ error: error?.message || "Snapshot refresh failed" });
  }
});

// 8. Oracle History Backfill Admin APIs
app.post("/api/admin/oracle-history/backfill", async (req, res) => {
  try {
    if (!hasOracleConfig()) {
      return res.status(503).json({ error: "Oracle database is not configured" });
    }

    if (!snapshotPrisma.oracleImportRun || !snapshotPrisma.productionWellHistory || !snapshotPrisma.waterWellHistory) {
      return res.status(503).json({ error: "History tables not available. Run prisma db push first." });
    }

    const body = HistoryBackfillRequestSchema.parse(req.body ?? {});

    const datasets: Array<typeof PRODUCTION_HISTORY_DATASET | typeof WATER_HISTORY_DATASET> =
      body.dataset === "all"
        ? [PRODUCTION_HISTORY_DATASET, WATER_HISTORY_DATASET]
        : [body.dataset];

    const units = body.unit === "all" ? [...PRODUCTION_UNITS] : [body.unit];

    if (activeBackfillJob) {
      return res.status(409).json({
        error: "A backfill job is already running",
        dryRun: false,
      });
    }

    const job = runHistoryBackfill({
      datasets,
      units,
      factoryName: body.factoryName,
      startDate: body.startDate,
      endDate: body.endDate,
      dryRun: body.dryRun,
      rebuildSnapshots: body.rebuildSnapshots,
    });

    activeBackfillJob = job;

    job
      .then(async (summaries) => {
        activeBackfillJob = null;

        if (body.rebuildSnapshots && !body.dryRun) {
          try {
            const results = await rebuildSnapshotsFromHistory();
            console.log("[history-backfill] Snapshots rebuilt:", results);
          } catch (error) {
            console.error("[history-backfill] Snapshot rebuild failed:", error);
          }
        }
      })
      .catch((error) => {
        activeBackfillJob = null;
        console.error("[history-backfill] Job failed:", error);
      });

    res.status(202).json({
      message: body.dryRun ? "Dry-run backfill started" : "Backfill started",
      dryRun: body.dryRun,
      datasets,
      units,
      startDate: body.startDate,
      endDate: body.endDate,
      factoryName: body.factoryName,
      totalMonthWindows: getMonthWindows(body.startDate, body.endDate).length,
      totalChunks: datasets.length * units.length * getMonthWindows(body.startDate, body.endDate).length,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid backfill request", details: error.issues });
    }
    res.status(500).json({ error: error?.message || "Backfill failed" });
  }
});

app.get("/api/admin/oracle-history/runs", async (req, res) => {
  try {
    if (!snapshotPrisma.oracleImportRun) {
      return res.json({ runs: [], total: 0 });
    }

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const dataset = req.query.dataset as string | undefined;

    const where: any = {};
    if (dataset && dataset !== "all") {
      where.dataset = dataset;
    }

    const [runs, total] = await Promise.all([
      snapshotPrisma.oracleImportRun.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      snapshotPrisma.oracleImportRun.count({ where }),
    ]);

    res.json({ runs, total, limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to fetch import runs" });
  }
});

app.get("/api/admin/oracle-history/status", async (req, res) => {
  try {
    if (!snapshotPrisma.oracleImportRun) {
      return res.json({
        backfillInProgress: false,
        lastRun: null,
        summary: { production: null, water: null },
      });
    }

    const [lastProduction, lastWater, runningCount] = await Promise.all([
      snapshotPrisma.oracleImportRun.findFirst({
        where: { dataset: PRODUCTION_HISTORY_DATASET },
        orderBy: { startedAt: "desc" },
      }),
      snapshotPrisma.oracleImportRun.findFirst({
        where: { dataset: WATER_HISTORY_DATASET },
        orderBy: { startedAt: "desc" },
      }),
      snapshotPrisma.oracleImportRun.count({
        where: { status: "RUNNING" },
      }),
    ]);

    // Aggregate row counts by dataset
    const [productionAgg, waterAgg] = await Promise.all([
      snapshotPrisma.oracleImportRun.groupBy({
        by: ["dataset"],
        where: { dataset: PRODUCTION_HISTORY_DATASET, status: "COMPLETED" },
        _sum: { rowCount: true },
        _count: { id: true },
      }),
      snapshotPrisma.oracleImportRun.groupBy({
        by: ["dataset"],
        where: { dataset: WATER_HISTORY_DATASET, status: "COMPLETED" },
        _sum: { rowCount: true },
        _count: { id: true },
      }),
    ]);

    // Count rows in history tables
    let productionRowCount = 0;
    let waterRowCount = 0;
    if (snapshotPrisma.productionWellHistory) {
      productionRowCount = await snapshotPrisma.productionWellHistory.count();
    }
    if (snapshotPrisma.waterWellHistory) {
      waterRowCount = await snapshotPrisma.waterWellHistory.count();
    }

    res.json({
      backfillInProgress: runningCount > 0,
      lastRun: {
        production: lastProduction,
        water: lastWater,
      },
      summary: {
        production: {
          totalChunks: productionAgg[0]?._count?.id ?? 0,
          totalImported: productionAgg[0]?._sum?.rowCount ?? 0,
          totalInTable: productionRowCount,
        },
        water: {
          totalChunks: waterAgg[0]?._count?.id ?? 0,
          totalImported: waterAgg[0]?._sum?.rowCount ?? 0,
          totalInTable: waterRowCount,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to fetch backfill status" });
  }
});

app.post("/api/admin/oracle-history/rebuild-snapshots", async (req, res) => {
  try {
    if (!snapshotPrisma.productionWellHistory || !snapshotPrisma.waterWellHistory) {
      return res.status(503).json({ error: "History tables not available" });
    }

    const results = await rebuildSnapshotsFromHistory();
    res.json({ ok: true, ...results });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Snapshot rebuild failed" });
  }
});

async function scheduleSnapshotRefreshes() {
  if (!snapshotPrisma.oracleRefreshBatch || !hasOracleConfig()) {
    return;
  }

  const runAll = async (trigger: string) => {
    await Promise.all([
      runRefreshJob(PRODUCTION_SNAPSHOT_DATASET, trigger),
      runRefreshJob(WATER_SNAPSHOT_DATASET, trigger),
    ]);
  };

  void runAll("startup").catch(error => {
    console.error("Initial Oracle snapshot refresh failed:", error);
  });

  setInterval(() => {
    void runAll("interval").catch(error => {
      console.error("Scheduled Oracle snapshot refresh failed:", error);
    });
  }, ORACLE_REFRESH_INTERVAL_MS);
}

// --- Vite Middleware ---
async function startServer() {
  await ensureUploadDirectories();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: {
          ignored: [
            "**/.codex-runtime/**",
            "**/dist/**",
            "**/uploads/**",
            "**/tmp-ppt-batch/**",
            "**/node_modules/**",
          ],
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  await scheduleSnapshotRefreshes();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

const isTestRuntime = process.env.NODE_ENV === "test" || process.argv.some(arg => arg === "--test" || arg.includes("node:test"));
if (!isTestRuntime) {
  void startServer();
}
