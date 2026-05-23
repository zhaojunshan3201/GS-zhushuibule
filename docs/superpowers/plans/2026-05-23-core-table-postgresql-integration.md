# Core Table PostgreSQL Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the first batch of core table pages in PostgreSQL and make add, delete, filter, and pagination use backend APIs instead of frontend mock arrays.

**Architecture:** Add Prisma models for the missing page tables, seed current mock rows into PostgreSQL when tables are empty, expose paginated Express CRUD APIs, and update React pages to fetch and mutate through those APIs. Keep the current visual layout and leave second-batch pages unchanged.

**Tech Stack:** React 19, TypeScript, Express, Prisma 5, PostgreSQL, Node `node:test`, Axios.

---

## File Structure

- Modify `prisma/schema.prisma`: add `InjectionTechRecord`, `WellFlushingRecord`, and `AbnormalWellRecord`; adjust `WaterCutRecord` to support direct page rows.
- Create `prisma/migrations/202605230001_core_table_records/migration.sql`: SQL migration for the new/updated tables.
- Create `src/shared/coreTableRecords.ts`: shared types, seed row builders, filter normalizers, and payload normalizers used by tests and server.
- Modify `server.ts`: add validation schemas, seed-on-empty helper, paginated APIs, and retain dynamic adjustment APIs.
- Modify `src/App.tsx`: replace first-batch mock table data paths with API-backed state and create/delete controls.
- Create `tests/coreTableRecords.test.ts`: test shared normalization/filter behavior before production code changes.
- Keep `tests/dynamicAdjustment.test.ts`: extend only if needed to cover dynamic adjustment mock removal helper behavior.

No git commit steps are included because this workspace currently has no `.git` directory.

---

### Task 1: Shared Core Table Helpers

**Files:**
- Create: `src/shared/coreTableRecords.ts`
- Test: `tests/coreTableRecords.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `tests/coreTableRecords.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAbnormalWellWhere,
  buildDateRange,
  buildWaterCutWhere,
  normalizePagination,
  normalizeWaterCutPayload,
} from "../src/shared/coreTableRecords";

test("normalizePagination clamps invalid page and pageSize", () => {
  assert.deepEqual(normalizePagination({ page: "0", pageSize: "500" }), {
    page: 1,
    pageSize: 100,
    skip: 0,
    take: 100,
  });
});

test("buildDateRange creates inclusive UTC day bounds", () => {
  assert.deepEqual(buildDateRange("2026-05-01", "2026-05-03"), {
    gte: new Date("2026-05-01T00:00:00.000Z"),
    lte: new Date("2026-05-03T23:59:59.999Z"),
  });
});

test("normalizeWaterCutPayload trims fields and converts water cut to number", () => {
  assert.deepEqual(
    normalizeWaterCutPayload({
      unit: " 采油作业一区 ",
      block: " 区块A ",
      wellNo: " GS-201 ",
      sampleDate: "2026-05-20",
      waterCut: "92.5%",
      tester: " 张三 ",
      remark: " 正常 ",
    }),
    {
      unit: "采油作业一区",
      block: "区块A",
      wellNo: "GS-201",
      sampleDate: "2026-05-20",
      waterCut: 92.5,
      tester: "张三",
      remark: "正常",
    },
  );
});

test("buildWaterCutWhere keeps filtering on the server side shape", () => {
  assert.deepEqual(buildWaterCutWhere({ unit: "采油作业一区", wellNo: "GS", waterCutRange: "94+" }), {
    unit: "采油作业一区",
    wellNo: { contains: "GS", mode: "insensitive" },
    waterCut: { gte: 94 },
  });
});

test("buildAbnormalWellWhere supports category and well number filters", () => {
  assert.deepEqual(buildAbnormalWellWhere({ category: "欠注", wellNo: "GS-0" }), {
    category: "欠注",
    wellNo: { contains: "GS-0", mode: "insensitive" },
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/coreTableRecords.test.ts`

Expected: FAIL because `src/shared/coreTableRecords.ts` does not exist.

- [ ] **Step 3: Implement shared helpers**

Create `src/shared/coreTableRecords.ts` with exported types and functions:

```ts
export type PaginationInput = { page?: unknown; pageSize?: unknown };

export function normalizePagination(input: PaginationInput) {
  const rawPage = Number(input.page ?? 1);
  const rawPageSize = Number(input.pageSize ?? 15);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), 100) : 15;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

const trim = (value: unknown) => String(value ?? "").trim();

export function toNullableText(value: unknown) {
  const text = trim(value);
  return text || null;
}

export function toNumberOrNull(value: unknown) {
  const text = trim(value).replace(/%$/, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildDateRange(fromDate?: unknown, toDate?: unknown) {
  const from = trim(fromDate);
  const to = trim(toDate);
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  };
}

export function normalizeWaterCutPayload(input: Record<string, unknown>) {
  return {
    unit: trim(input.unit),
    block: trim(input.block),
    wellNo: trim(input.wellNo),
    sampleDate: trim(input.sampleDate),
    waterCut: toNumberOrNull(input.waterCut),
    tester: trim(input.tester),
    remark: toNullableText(input.remark),
  };
}

export function buildWaterCutWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  if (trim(query.unit)) where.unit = trim(query.unit);
  if (trim(query.block)) where.block = trim(query.block);
  if (trim(query.wellNo)) where.wellNo = { contains: trim(query.wellNo), mode: "insensitive" };
  if (trim(query.waterCutRange) === "90-") where.waterCut = { lt: 90 };
  if (trim(query.waterCutRange) === "90-92") where.waterCut = { gte: 90, lt: 92 };
  if (trim(query.waterCutRange) === "92-94") where.waterCut = { gte: 92, lt: 94 };
  if (trim(query.waterCutRange) === "94+") where.waterCut = { gte: 94 };
  const dateRange = buildDateRange(query.fromDate, query.toDate);
  if (Object.keys(dateRange).length) where.sampleDate = dateRange;
  return where;
}

export function buildAbnormalWellWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  if (trim(query.unit)) where.unit = trim(query.unit);
  if (trim(query.block)) where.block = trim(query.block);
  if (trim(query.category)) where.category = trim(query.category);
  if (trim(query.process)) where.process = trim(query.process);
  if (trim(query.wellNo)) where.wellNo = { contains: trim(query.wellNo), mode: "insensitive" };
  return where;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/coreTableRecords.test.ts`

Expected: PASS.

---

### Task 2: Prisma Schema And Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/202605230001_core_table_records/migration.sql`

- [ ] **Step 1: Update Prisma schema**

In `prisma/schema.prisma`, replace `WaterCutRecord` with a direct table model and add the three missing models:

```prisma
model WaterCutRecord {
  id         String   @id @default(uuid())
  unit       String
  block      String
  wellNo     String
  sampleDate DateTime @db.Date
  waterCut   Float
  tester     String
  remark     String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([unit])
  @@index([block])
  @@index([wellNo])
  @@index([sampleDate])
  @@index([waterCut])
}

model InjectionTechRecord {
  id              String   @id @default(uuid())
  wellNo          String
  block           String
  workArea        String
  process         String
  packerCount     Int
  packerModels    Json
  bottomStructure String
  washable        String
  doublePacker    String
  washReminder    String?
  lastWorkDate    DateTime @db.Date
  runningDate     DateTime @db.Date
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([wellNo])
  @@index([block])
  @@index([workArea])
  @@index([process])
  @@index([packerCount])
  @@index([bottomStructure])
}

model WellFlushingRecord {
  id                String   @id @default(uuid())
  unit              String
  wellNo            String
  washDate          DateTime @db.Date
  daysSinceLastWash Int
  method            String
  equipmentPressure Float?
  duration          Float?
  totalWater        Float?
  firstLevel        Json
  secondLevel       Json
  suspendedMatter   Json
  remark            String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([unit])
  @@index([wellNo])
  @@index([washDate])
}

model AbnormalWellRecord {
  id                     String   @id @default(uuid())
  category               String
  wellNo                 String
  block                  String
  unit                   String
  process                String
  normalDaily            String?
  normalOilPressure      String?
  normalCasingPressure   String?
  normalLayerPressure    String?
  abnormalDaily          String?
  abnormalOilPressure    String?
  abnormalCasingPressure String?
  abnormalLayerPressure  String?
  suggestion             String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  @@index([category])
  @@index([wellNo])
  @@index([block])
  @@index([unit])
  @@index([process])
}
```

Also remove `waterCuts WaterCutRecord[]` from `model Well` because `WaterCutRecord` no longer relates to `Well`.

- [ ] **Step 2: Add SQL migration**

Create `prisma/migrations/202605230001_core_table_records/migration.sql`:

```sql
ALTER TABLE "WaterCutRecord" DROP CONSTRAINT IF EXISTS "WaterCutRecord_wellId_fkey";
DROP INDEX IF EXISTS "WaterCutRecord_wellId_idx";
DROP TABLE IF EXISTS "WaterCutRecord";

CREATE TABLE "WaterCutRecord" (
  "id" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "block" TEXT NOT NULL,
  "wellNo" TEXT NOT NULL,
  "sampleDate" DATE NOT NULL,
  "waterCut" DOUBLE PRECISION NOT NULL,
  "tester" TEXT NOT NULL,
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaterCutRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WaterCutRecord_unit_idx" ON "WaterCutRecord"("unit");
CREATE INDEX "WaterCutRecord_block_idx" ON "WaterCutRecord"("block");
CREATE INDEX "WaterCutRecord_wellNo_idx" ON "WaterCutRecord"("wellNo");
CREATE INDEX "WaterCutRecord_sampleDate_idx" ON "WaterCutRecord"("sampleDate");
CREATE INDEX "WaterCutRecord_waterCut_idx" ON "WaterCutRecord"("waterCut");

CREATE TABLE "InjectionTechRecord" (
  "id" TEXT NOT NULL,
  "wellNo" TEXT NOT NULL,
  "block" TEXT NOT NULL,
  "workArea" TEXT NOT NULL,
  "process" TEXT NOT NULL,
  "packerCount" INTEGER NOT NULL,
  "packerModels" JSONB NOT NULL,
  "bottomStructure" TEXT NOT NULL,
  "washable" TEXT NOT NULL,
  "doublePacker" TEXT NOT NULL,
  "washReminder" TEXT,
  "lastWorkDate" DATE NOT NULL,
  "runningDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InjectionTechRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InjectionTechRecord_wellNo_idx" ON "InjectionTechRecord"("wellNo");
CREATE INDEX "InjectionTechRecord_block_idx" ON "InjectionTechRecord"("block");
CREATE INDEX "InjectionTechRecord_workArea_idx" ON "InjectionTechRecord"("workArea");
CREATE INDEX "InjectionTechRecord_process_idx" ON "InjectionTechRecord"("process");
CREATE INDEX "InjectionTechRecord_packerCount_idx" ON "InjectionTechRecord"("packerCount");
CREATE INDEX "InjectionTechRecord_bottomStructure_idx" ON "InjectionTechRecord"("bottomStructure");

CREATE TABLE "WellFlushingRecord" (
  "id" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "wellNo" TEXT NOT NULL,
  "washDate" DATE NOT NULL,
  "daysSinceLastWash" INTEGER NOT NULL,
  "method" TEXT NOT NULL,
  "equipmentPressure" DOUBLE PRECISION,
  "duration" DOUBLE PRECISION,
  "totalWater" DOUBLE PRECISION,
  "firstLevel" JSONB NOT NULL,
  "secondLevel" JSONB NOT NULL,
  "suspendedMatter" JSONB NOT NULL,
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WellFlushingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WellFlushingRecord_unit_idx" ON "WellFlushingRecord"("unit");
CREATE INDEX "WellFlushingRecord_wellNo_idx" ON "WellFlushingRecord"("wellNo");
CREATE INDEX "WellFlushingRecord_washDate_idx" ON "WellFlushingRecord"("washDate");

CREATE TABLE "AbnormalWellRecord" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "wellNo" TEXT NOT NULL,
  "block" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "process" TEXT NOT NULL,
  "normalDaily" TEXT,
  "normalOilPressure" TEXT,
  "normalCasingPressure" TEXT,
  "normalLayerPressure" TEXT,
  "abnormalDaily" TEXT,
  "abnormalOilPressure" TEXT,
  "abnormalCasingPressure" TEXT,
  "abnormalLayerPressure" TEXT,
  "suggestion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AbnormalWellRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AbnormalWellRecord_category_idx" ON "AbnormalWellRecord"("category");
CREATE INDEX "AbnormalWellRecord_wellNo_idx" ON "AbnormalWellRecord"("wellNo");
CREATE INDEX "AbnormalWellRecord_block_idx" ON "AbnormalWellRecord"("block");
CREATE INDEX "AbnormalWellRecord_unit_idx" ON "AbnormalWellRecord"("unit");
CREATE INDEX "AbnormalWellRecord_process_idx" ON "AbnormalWellRecord"("process");
```

- [ ] **Step 3: Generate Prisma client**

Run: `npx prisma generate`

Expected: Prisma Client generated successfully.

---

### Task 3: Backend APIs And Seed-On-Empty

**Files:**
- Modify: `server.ts`
- Modify: `src/shared/coreTableRecords.ts`
- Test: `tests/coreTableRecords.test.ts`

- [ ] **Step 1: Add seed row builders to shared file with tests first**

Extend `tests/coreTableRecords.test.ts`:

```ts
import { buildCoreTableSeedRows } from "../src/shared/coreTableRecords";

test("buildCoreTableSeedRows provides first-batch seed data", () => {
  const seeds = buildCoreTableSeedRows();
  assert.equal(seeds.waterCuts.length, 75);
  assert.equal(seeds.injectionTechRecords.length, 50);
  assert.equal(seeds.wellFlushingRecords.length, 38);
  assert.equal(seeds.abnormalWellRecords.length, 38);
  assert.equal(seeds.dynamicAdjustments.length, 38);
});
```

Run: `npm test -- tests/coreTableRecords.test.ts`

Expected: FAIL because `buildCoreTableSeedRows` is missing.

- [ ] **Step 2: Implement seed builders**

Move the first-batch mock row generator logic from `src/App.tsx` into `src/shared/coreTableRecords.ts` as `buildCoreTableSeedRows()`. Export arrays named:

```ts
export function buildCoreTableSeedRows() {
  return {
    waterCuts,
    injectionTechRecords,
    wellFlushingRecords,
    abnormalWellRecords,
    dynamicAdjustments,
  };
}
```

Use the same row counts and visible values currently generated in `src/App.tsx`.

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/coreTableRecords.test.ts`

Expected: PASS.

- [ ] **Step 4: Add Express APIs**

In `server.ts`, import helpers:

```ts
import {
  buildAbnormalWellWhere,
  buildCoreTableSeedRows,
  buildDateRange,
  buildWaterCutWhere,
  normalizePagination,
  normalizeWaterCutPayload,
  toNullableText,
  toNumberOrNull,
} from "./src/shared/coreTableRecords";
```

Add route helpers near Business Module APIs:

```ts
const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const paginatedResponse = (rows: unknown[], total: number, page: number, pageSize: number) => ({
  rows,
  total,
  page,
  pageSize,
});
```

Implement endpoints:

```ts
app.get("/api/water-cuts", async (req, res) => {
  const { page, pageSize, skip, take } = normalizePagination(req.query);
  const where = buildWaterCutWhere(req.query as Record<string, unknown>);
  const [rows, total] = await Promise.all([
    prisma.waterCutRecord.findMany({ where, orderBy: [{ sampleDate: "desc" }, { wellNo: "asc" }], skip, take }),
    prisma.waterCutRecord.count({ where }),
  ]);
  res.json(paginatedResponse(rows, total, page, pageSize));
});

app.post("/api/water-cuts", async (req, res) => {
  const data = normalizeWaterCutPayload(req.body);
  if (!data.unit || !data.block || !data.wellNo || !data.sampleDate || data.waterCut === null || !data.tester) {
    return res.status(400).json({ error: "含水化验记录缺少必填字段" });
  }
  const record = await prisma.waterCutRecord.create({ data: { ...data, sampleDate: toDate(data.sampleDate), waterCut: data.waterCut } });
  res.status(201).json(record);
});

app.delete("/api/water-cuts/:id", async (req, res) => {
  try {
    await prisma.waterCutRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "含水化验记录不存在" });
  }
});
```

Add equivalent `GET`, `POST`, and `DELETE` routes for:

- `/api/injection-tech-records`
- `/api/well-flushing-records`
- `/api/abnormal-well-records`

Each `GET` must use `normalizePagination`, Prisma `where`, `skip`, and `take`. Each `POST` must validate page-required fields. Each `DELETE` must return `204` or `404`.

- [ ] **Step 5: Seed on empty during `/api/seed`**

In `app.get("/api/seed")`, after existing seed logic, add:

```ts
const seeds = buildCoreTableSeedRows();
if ((await prisma.waterCutRecord.count()) === 0) {
  await prisma.waterCutRecord.createMany({
    data: seeds.waterCuts.map((row) => ({ ...row, sampleDate: toDate(row.sampleDate) })),
  });
}
if ((await prisma.injectionTechRecord.count()) === 0) {
  await prisma.injectionTechRecord.createMany({
    data: seeds.injectionTechRecords.map((row) => ({
      ...row,
      lastWorkDate: toDate(row.lastWorkDate),
      runningDate: toDate(row.runningDate),
      packerModels: row.packerModels,
    })),
  });
}
if ((await prisma.wellFlushingRecord.count()) === 0) {
  await prisma.wellFlushingRecord.createMany({
    data: seeds.wellFlushingRecords.map((row) => ({
      ...row,
      washDate: toDate(row.washDate),
      firstLevel: row.firstLevel,
      secondLevel: row.secondLevel,
      suspendedMatter: row.suspendedMatter,
    })),
  });
}
if ((await prisma.abnormalWellRecord.count()) === 0) {
  await prisma.abnormalWellRecord.createMany({ data: seeds.abnormalWellRecords });
}
if ((await prisma.dynamicAdjustmentRecord.count()) === 0) {
  await prisma.dynamicAdjustmentRecord.createMany({
    data: seeds.dynamicAdjustments.map((row) => ({ ...row, adjustmentDate: toDate(row.adjustmentDate) })),
  });
}
```

- [ ] **Step 6: Run backend type check**

Run: `npm run lint`

Expected: PASS or only pre-existing encoding text remains without TypeScript errors.

---

### Task 4: Frontend API Integration For First-Batch Pages

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add shared frontend response types**

Near the existing type declarations in `src/App.tsx`, add:

```ts
type PaginatedResponse<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
};
```

Add row types matching the five first-batch pages.

- [ ] **Step 2: Update 含水化验**

Replace `WATER_CUT_ROWS` active usage with:

```ts
const [rows, setRows] = useState<WaterCutPageRecord[]>([]);
const [totalRows, setTotalRows] = useState(0);
const [filters, setFilters] = useState({ unit: "", block: "", wellNo: "", waterCutRange: "" });
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

const loadRows = async (page = currentPage) => {
  setLoading(true);
  setError("");
  try {
    const { data } = await axios.get<PaginatedResponse<WaterCutPageRecord>>("/api/water-cuts", {
      params: { ...filters, page, pageSize: WATER_CUT_PAGE_SIZE },
    });
    setRows(data.rows);
    setTotalRows(data.total);
    setCurrentPage(data.page);
    setJumpPage(String(data.page));
  } catch (err: any) {
    setError(err?.response?.data?.error || "含水化验记录加载失败");
  } finally {
    setLoading(false);
  }
};
```

Wire 确定 to `loadRows(1)`. Add a compact create form and a delete button per row calling `POST /api/water-cuts` and `DELETE /api/water-cuts/:id`.

- [ ] **Step 3: Update 注水工艺**

Replace `INJECTION_TECH_ROWS` filtering and pagination with `GET /api/injection-tech-records`. Keep the same columns. Render `row.packerModels` from the API. Add 新增 and 删除 buttons.

- [ ] **Step 4: Update 水井洗井**

Replace `WELL_FLUSHING_ROWS` with `GET /api/well-flushing-records`. Send `unit`, `wellNo`, `fromDate`, and `toDate`. Add 新增 and 删除 buttons. Keep JSON array display for `firstLevel`, `secondLevel`, and `suspendedMatter`.

- [ ] **Step 5: Update 异常水井**

Replace `ABNORMAL_WELL_ROWS` with `GET /api/abnormal-well-records`. If `ZonalTableShell` cannot safely be made controlled without affecting second-batch pages, keep the page-local filter bar for this page only and pass `filterMode` only for layout. Add 新增 and 删除 buttons.

- [ ] **Step 6: Update 动态调配**

Delete the `DYNAMIC_ADJUSTMENT_MOCK_ROWS` constant and replace:

```ts
const visibleRows = records.length ? records : DYNAMIC_ADJUSTMENT_MOCK_ROWS;
```

with:

```ts
const visibleRows = records;
```

Render the existing no-data row when `pagedRows.length === 0`.

- [ ] **Step 7: Run frontend type check**

Run: `npm run lint`

Expected: PASS.

---

### Task 5: Database Migration And Smoke Verification

**Files:**
- No source edits unless verification reveals a defect.

- [ ] **Step 1: Apply migration**

Run: `npx prisma migrate deploy`

Expected: migration `202605230001_core_table_records` applied.

- [ ] **Step 2: Seed data**

Start the dev server if needed:

Run: `npm run dev`

Then call: `Invoke-WebRequest -UseBasicParsing http://localhost:5000/api/seed`

Expected: seed response succeeds and first-batch tables contain current mock data.

- [ ] **Step 3: API smoke checks**

Run these PowerShell checks:

```powershell
Invoke-RestMethod "http://localhost:5000/api/water-cuts?page=1&pageSize=5&wellNo=GS" | ConvertTo-Json -Depth 4
Invoke-RestMethod "http://localhost:5000/api/injection-tech-records?page=1&pageSize=5&workArea=采油作业一区" | ConvertTo-Json -Depth 4
Invoke-RestMethod "http://localhost:5000/api/well-flushing-records?page=1&pageSize=5&fromDate=2026-05-01&toDate=2026-05-31" | ConvertTo-Json -Depth 4
Invoke-RestMethod "http://localhost:5000/api/abnormal-well-records?page=1&pageSize=5&category=欠注" | ConvertTo-Json -Depth 4
```

Expected: each returns `rows`, `total`, `page`, and `pageSize`.

- [ ] **Step 4: Full verification**

Run:

```powershell
npm test
npm run lint
```

Expected: both pass.

- [ ] **Step 5: Browser verification**

Open `http://localhost:5000` and verify:

- 含水化验 loads database rows, filters by well number, creates a row, deletes it, and preserves state across refresh.
- 注水工艺 loads database rows, filters by work area/process, creates a row, deletes it, and preserves state across refresh.
- 水井洗井 filters by date range and supports create/delete.
- 异常水井 filters by category/well number and supports create/delete.
- 动态调配 shows database rows only; if the table is empty it shows 暂无数据 instead of mock rows.

---

## Self-Review

- Spec coverage: all first-batch pages have data models, APIs, frontend integration, seeding, and verification tasks.
- Scope: second-batch pages are not modified.
- Reserved-marker scan: no reserved planning markers or intentionally vague implementation steps remain.
- Type consistency: API response shape is `PaginatedResponse<T>` for new endpoints; dynamic adjustment keeps its existing array API.
