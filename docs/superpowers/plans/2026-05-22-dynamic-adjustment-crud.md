# Dynamic Adjustment CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the “动态调配” page as a persistent CRUD business table whose visible columns match the provided screenshot.

**Architecture:** Add a dedicated Prisma model for dynamic adjustment records, a small shared TypeScript helper for normalization and diff calculation, Express CRUD endpoints, and a React page that replaces the current placeholder. The shared helper is covered by Node tests first, then reused by the API and frontend to keep calculations consistent.

**Tech Stack:** React 19, Vite, TypeScript, Express, Prisma, Zod, axios, Node built-in test runner through `tsx --test`.

---

## File Structure

- Create `src/shared/dynamicAdjustment.ts`
  - Owns the field names, form defaults, numeric parsing, diff calculation, and payload normalization.
  - Imported by both `server.ts` and `src/App.tsx`.
- Create `tests/dynamicAdjustment.test.ts`
  - Uses `node:test` and `node:assert/strict` to test the shared helper.
- Modify `package.json`
  - Add `test` script using the existing `tsx` dependency.
- Modify `prisma/schema.prisma`
  - Add `DynamicAdjustmentRecord`.
- Modify `server.ts`
  - Import the shared helper.
  - Add Zod schemas and `/api/dynamic-adjustments` CRUD endpoints.
- Modify `src/App.tsx`
  - Import helper types/constants.
  - Add `DynamicAdjustmentPage`.
  - Replace the current dynamic-adjustment placeholder route with the real page.

---

### Task 1: Add Test Harness And Shared Helper Tests

**Files:**
- Modify: `package.json`
- Create: `tests/dynamicAdjustment.test.ts`

- [ ] **Step 1: Add the test script**

Modify `package.json` scripts to include:

```json
"test": "tsx --test tests/**/*.test.ts"
```

Keep the existing scripts unchanged.

- [ ] **Step 2: Write failing tests for dynamic adjustment helper behavior**

Create `tests/dynamicAdjustment.test.ts`:

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDynamicAdjustmentDiffs,
  createEmptyDynamicAdjustmentForm,
  normalizeDynamicAdjustmentPayload,
} from "../src/shared/dynamicAdjustment";

test("calculateDynamicAdjustmentDiffs subtracts before values from after values", () => {
  const result = calculateDynamicAdjustmentDiffs({
    beforeDailyLiquid: 7.2,
    beforeDailyOil: 3.6,
    beforeWaterCut: 35,
    afterDailyLiquid: 8.1,
    afterDailyOil: 4,
    afterWaterCut: 32,
  });

  assert.deepEqual(result, {
    diffDailyLiquid: 0.9,
    diffDailyOil: 0.4,
    diffWaterCut: -3,
  });
});

test("calculateDynamicAdjustmentDiffs returns null when either side is missing", () => {
  const result = calculateDynamicAdjustmentDiffs({
    beforeDailyLiquid: 7.2,
    beforeDailyOil: null,
    beforeWaterCut: 35,
    afterDailyLiquid: 8.1,
    afterDailyOil: 4,
    afterWaterCut: undefined,
  });

  assert.deepEqual(result, {
    diffDailyLiquid: 0.9,
    diffDailyOil: null,
    diffWaterCut: null,
  });
});

test("normalizeDynamicAdjustmentPayload trims text and converts numeric strings", () => {
  const result = normalizeDynamicAdjustmentPayload({
    adjustmentWaterWell: " 高2-4-055 ",
    injectionProcess: " 分注 ",
    adjustmentDate: "2026-05-22",
    beforeDailyInjection: "12.5",
    afterDailyInjection: "14",
    adjustmentPurpose: " 解决污水平衡 ",
    trackedOilWell: " 高2-4-075 ",
    beforeDailyLiquid: "7.2",
    beforeDailyOil: "3.6",
    beforeWaterCut: "35",
    afterDailyLiquid: "8.1",
    afterDailyOil: "4",
    afterWaterCut: "32",
    stageDays: "30",
    cumulativeOil: "12",
    remark: " 现场复核 ",
  });

  assert.deepEqual(result, {
    adjustmentWaterWell: "高2-4-055",
    injectionProcess: "分注",
    adjustmentDate: "2026-05-22",
    beforeDailyInjection: 12.5,
    afterDailyInjection: 14,
    adjustmentPurpose: "解决污水平衡",
    trackedOilWell: "高2-4-075",
    beforeDailyLiquid: 7.2,
    beforeDailyOil: 3.6,
    beforeWaterCut: 35,
    afterDailyLiquid: 8.1,
    afterDailyOil: 4,
    afterWaterCut: 32,
    diffDailyLiquid: 0.9,
    diffDailyOil: 0.4,
    diffWaterCut: -3,
    stageDays: 30,
    cumulativeOil: 12,
    remark: "现场复核",
  });
});

test("createEmptyDynamicAdjustmentForm keeps screenshot default purposes available", () => {
  const form = createEmptyDynamicAdjustmentForm();

  assert.equal(form.adjustmentPurpose, "解决污水平衡");
  assert.equal(form.adjustmentWaterWell, "");
  assert.equal(form.trackedOilWell, "");
});
```

- [ ] **Step 3: Run tests and verify they fail because the helper does not exist**

Run:

```powershell
npm test
```

Expected: FAIL with a module resolution error for `../src/shared/dynamicAdjustment`.

- [ ] **Step 4: Commit test harness if inside a git repository**

Run:

```powershell
git status --short
```

Expected in this workspace: `fatal: not a git repository...`; skip commit here. If implementing from a git repository, commit with:

```powershell
git add package.json tests/dynamicAdjustment.test.ts
git commit -m "test: add dynamic adjustment helper tests"
```

---

### Task 2: Implement Shared Dynamic Adjustment Helper

**Files:**
- Create: `src/shared/dynamicAdjustment.ts`
- Test: `tests/dynamicAdjustment.test.ts`

- [ ] **Step 1: Add the helper implementation**

Create `src/shared/dynamicAdjustment.ts`:

```typescript
export const DYNAMIC_ADJUSTMENT_PURPOSES = ["解决污水平衡", "油井产状变化"] as const;

export type DynamicAdjustmentPurpose = (typeof DYNAMIC_ADJUSTMENT_PURPOSES)[number];

export type DynamicAdjustmentNumericFields = {
  beforeDailyLiquid?: number | null;
  beforeDailyOil?: number | null;
  beforeWaterCut?: number | null;
  afterDailyLiquid?: number | null;
  afterDailyOil?: number | null;
  afterWaterCut?: number | null;
};

export type DynamicAdjustmentDiffs = {
  diffDailyLiquid: number | null;
  diffDailyOil: number | null;
  diffWaterCut: number | null;
};

export type DynamicAdjustmentForm = {
  adjustmentWaterWell: string;
  injectionProcess: string;
  adjustmentDate: string;
  beforeDailyInjection: string;
  afterDailyInjection: string;
  adjustmentPurpose: DynamicAdjustmentPurpose;
  trackedOilWell: string;
  beforeDailyLiquid: string;
  beforeDailyOil: string;
  beforeWaterCut: string;
  afterDailyLiquid: string;
  afterDailyOil: string;
  afterWaterCut: string;
  stageDays: string;
  cumulativeOil: string;
  remark: string;
};

export type DynamicAdjustmentPayloadInput = Record<string, unknown>;

export type NormalizedDynamicAdjustmentPayload = {
  adjustmentWaterWell: string;
  injectionProcess: string | null;
  adjustmentDate: string;
  beforeDailyInjection: number | null;
  afterDailyInjection: number | null;
  adjustmentPurpose: string;
  trackedOilWell: string;
  beforeDailyLiquid: number | null;
  beforeDailyOil: number | null;
  beforeWaterCut: number | null;
  afterDailyLiquid: number | null;
  afterDailyOil: number | null;
  afterWaterCut: number | null;
  diffDailyLiquid: number | null;
  diffDailyOil: number | null;
  diffWaterCut: number | null;
  stageDays: number | null;
  cumulativeOil: number | null;
  remark: string | null;
};

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toTrimmedString = (value: unknown) => String(value ?? "").trim();

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateSingleDiff = (beforeValue?: number | null, afterValue?: number | null) => {
  if (beforeValue === null || beforeValue === undefined) return null;
  if (afterValue === null || afterValue === undefined) return null;
  return roundToTwo(afterValue - beforeValue);
};

export function calculateDynamicAdjustmentDiffs(values: DynamicAdjustmentNumericFields): DynamicAdjustmentDiffs {
  return {
    diffDailyLiquid: calculateSingleDiff(values.beforeDailyLiquid, values.afterDailyLiquid),
    diffDailyOil: calculateSingleDiff(values.beforeDailyOil, values.afterDailyOil),
    diffWaterCut: calculateSingleDiff(values.beforeWaterCut, values.afterWaterCut),
  };
}

export function createEmptyDynamicAdjustmentForm(): DynamicAdjustmentForm {
  return {
    adjustmentWaterWell: "",
    injectionProcess: "",
    adjustmentDate: new Date().toISOString().slice(0, 10),
    beforeDailyInjection: "",
    afterDailyInjection: "",
    adjustmentPurpose: DYNAMIC_ADJUSTMENT_PURPOSES[0],
    trackedOilWell: "",
    beforeDailyLiquid: "",
    beforeDailyOil: "",
    beforeWaterCut: "",
    afterDailyLiquid: "",
    afterDailyOil: "",
    afterWaterCut: "",
    stageDays: "",
    cumulativeOil: "",
    remark: "",
  };
}

export function normalizeDynamicAdjustmentPayload(input: DynamicAdjustmentPayloadInput): NormalizedDynamicAdjustmentPayload {
  const beforeDailyLiquid = toNullableNumber(input.beforeDailyLiquid);
  const beforeDailyOil = toNullableNumber(input.beforeDailyOil);
  const beforeWaterCut = toNullableNumber(input.beforeWaterCut);
  const afterDailyLiquid = toNullableNumber(input.afterDailyLiquid);
  const afterDailyOil = toNullableNumber(input.afterDailyOil);
  const afterWaterCut = toNullableNumber(input.afterWaterCut);
  const diffs = calculateDynamicAdjustmentDiffs({
    beforeDailyLiquid,
    beforeDailyOil,
    beforeWaterCut,
    afterDailyLiquid,
    afterDailyOil,
    afterWaterCut,
  });
  const injectionProcess = toTrimmedString(input.injectionProcess);
  const remark = toTrimmedString(input.remark);

  return {
    adjustmentWaterWell: toTrimmedString(input.adjustmentWaterWell),
    injectionProcess: injectionProcess || null,
    adjustmentDate: toTrimmedString(input.adjustmentDate),
    beforeDailyInjection: toNullableNumber(input.beforeDailyInjection),
    afterDailyInjection: toNullableNumber(input.afterDailyInjection),
    adjustmentPurpose: toTrimmedString(input.adjustmentPurpose),
    trackedOilWell: toTrimmedString(input.trackedOilWell),
    beforeDailyLiquid,
    beforeDailyOil,
    beforeWaterCut,
    afterDailyLiquid,
    afterDailyOil,
    afterWaterCut,
    ...diffs,
    stageDays: toNullableNumber(input.stageDays),
    cumulativeOil: toNullableNumber(input.cumulativeOil),
    remark: remark || null,
  };
}
```

- [ ] **Step 2: Run tests and verify they pass**

Run:

```powershell
npm test
```

Expected: PASS for all four dynamic adjustment helper tests.

- [ ] **Step 3: Commit helper if inside a git repository**

Run:

```powershell
git status --short
```

Expected in this workspace: `fatal: not a git repository...`; skip commit here. If implementing from a git repository, commit with:

```powershell
git add src/shared/dynamicAdjustment.ts tests/dynamicAdjustment.test.ts package.json
git commit -m "feat: add dynamic adjustment helper"
```

---

### Task 3: Add Prisma Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `DynamicAdjustmentRecord` model**

Append this model near the existing `AdjustmentRecord` model in `prisma/schema.prisma`:

```prisma
model DynamicAdjustmentRecord {
  id                   String   @id @default(uuid())
  adjustmentWaterWell  String
  injectionProcess     String?
  adjustmentDate       DateTime @db.Date
  beforeDailyInjection Float?
  afterDailyInjection  Float?
  adjustmentPurpose    String
  trackedOilWell       String
  beforeDailyLiquid    Float?
  beforeDailyOil       Float?
  beforeWaterCut       Float?
  afterDailyLiquid     Float?
  afterDailyOil        Float?
  afterWaterCut        Float?
  diffDailyLiquid      Float?
  diffDailyOil         Float?
  diffWaterCut         Float?
  stageDays            Int?
  cumulativeOil        Float?
  remark               String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([adjustmentDate])
  @@index([adjustmentWaterWell])
  @@index([trackedOilWell])
  @@index([adjustmentPurpose])
}
```

- [ ] **Step 2: Generate Prisma client**

Run:

```powershell
npx prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 3: Apply the schema to the local database**

Run:

```powershell
npx prisma db push
```

Expected: Database synced with Prisma schema.

- [ ] **Step 4: Commit model if inside a git repository**

Run:

```powershell
git status --short
```

Expected in this workspace: `fatal: not a git repository...`; skip commit here. If implementing from a git repository, commit with:

```powershell
git add prisma/schema.prisma package-lock.json package.json
git commit -m "feat: add dynamic adjustment model"
```

---

### Task 4: Add Express CRUD Endpoints

**Files:**
- Modify: `server.ts`
- Test: `tests/dynamicAdjustment.test.ts`

- [ ] **Step 1: Import shared helper**

At the top of `server.ts`, add:

```typescript
import {
  DYNAMIC_ADJUSTMENT_PURPOSES,
  normalizeDynamicAdjustmentPayload,
} from "./src/shared/dynamicAdjustment";
```

- [ ] **Step 2: Extend `snapshotPrisma` type**

In the `snapshotPrisma` declaration in `server.ts`, add:

```typescript
dynamicAdjustmentRecord?: any;
```

- [ ] **Step 3: Add Zod schema**

After `WellSchema`, add:

```typescript
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
```

- [ ] **Step 4: Add API routes**

Add these routes before the existing `/api/adjustments` endpoint:

```typescript
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
      orderBy: [{ adjustmentDate: "desc" }, { updatedAt: "desc" }],
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
    const record = await snapshotPrisma.dynamicAdjustmentRecord.create({
      data: {
        ...data,
        adjustmentDate: new Date(`${data.adjustmentDate}T00:00:00.000Z`),
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
    const record = await snapshotPrisma.dynamicAdjustmentRecord.update({
      where: { id: req.params.id },
      data: {
        ...data,
        adjustmentDate: new Date(`${data.adjustmentDate}T00:00:00.000Z`),
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
    res.status(500).json({ error: "动态调配记录删除失败", details: serializeError(error) });
  }
});
```

- [ ] **Step 5: Run helper tests**

Run:

```powershell
npm test
```

Expected: PASS for all dynamic adjustment helper tests.

- [ ] **Step 6: Run TypeScript check**

Run:

```powershell
npm run lint
```

Expected: TypeScript check exits with code 0.

- [ ] **Step 7: Commit API if inside a git repository**

Run:

```powershell
git status --short
```

Expected in this workspace: `fatal: not a git repository...`; skip commit here. If implementing from a git repository, commit with:

```powershell
git add server.ts src/shared/dynamicAdjustment.ts tests/dynamicAdjustment.test.ts package.json prisma/schema.prisma
git commit -m "feat: add dynamic adjustment api"
```

---

### Task 5: Replace Placeholder With Dynamic Adjustment Page

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import shared helper**

Add this import near the existing local imports:

```typescript
import {
  DYNAMIC_ADJUSTMENT_PURPOSES,
  calculateDynamicAdjustmentDiffs,
  createEmptyDynamicAdjustmentForm,
  type DynamicAdjustmentForm,
} from "./shared/dynamicAdjustment";
```

- [ ] **Step 2: Add frontend record type**

Add near the existing frontend type definitions:

```typescript
type DynamicAdjustmentRecord = {
  id: string;
  adjustmentWaterWell: string;
  injectionProcess?: string | null;
  adjustmentDate: string;
  beforeDailyInjection?: number | null;
  afterDailyInjection?: number | null;
  adjustmentPurpose: string;
  trackedOilWell: string;
  beforeDailyLiquid?: number | null;
  beforeDailyOil?: number | null;
  beforeWaterCut?: number | null;
  afterDailyLiquid?: number | null;
  afterDailyOil?: number | null;
  afterWaterCut?: number | null;
  diffDailyLiquid?: number | null;
  diffDailyOil?: number | null;
  diffWaterCut?: number | null;
  stageDays?: number | null;
  cumulativeOil?: number | null;
  remark?: string | null;
};
```

- [ ] **Step 3: Add display helpers**

Add before `DynamicAdjustmentPage`:

```typescript
const formatDateOnly = (value?: string | null) => {
  if (!value) return "";
  return String(value).slice(0, 10);
};

const formatNumberCell = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "";
  return String(value);
};

const formFromDynamicAdjustmentRecord = (record: DynamicAdjustmentRecord): DynamicAdjustmentForm => ({
  adjustmentWaterWell: record.adjustmentWaterWell,
  injectionProcess: record.injectionProcess ?? "",
  adjustmentDate: formatDateOnly(record.adjustmentDate),
  beforeDailyInjection: formatNumberCell(record.beforeDailyInjection),
  afterDailyInjection: formatNumberCell(record.afterDailyInjection),
  adjustmentPurpose: DYNAMIC_ADJUSTMENT_PURPOSES.includes(record.adjustmentPurpose as any)
    ? (record.adjustmentPurpose as DynamicAdjustmentForm["adjustmentPurpose"])
    : DYNAMIC_ADJUSTMENT_PURPOSES[0],
  trackedOilWell: record.trackedOilWell,
  beforeDailyLiquid: formatNumberCell(record.beforeDailyLiquid),
  beforeDailyOil: formatNumberCell(record.beforeDailyOil),
  beforeWaterCut: formatNumberCell(record.beforeWaterCut),
  afterDailyLiquid: formatNumberCell(record.afterDailyLiquid),
  afterDailyOil: formatNumberCell(record.afterDailyOil),
  afterWaterCut: formatNumberCell(record.afterWaterCut),
  stageDays: formatNumberCell(record.stageDays),
  cumulativeOil: formatNumberCell(record.cumulativeOil),
  remark: record.remark ?? "",
});
```

- [ ] **Step 4: Add `DynamicAdjustmentPage`**

Add this component before the main `App` component:

```tsx
function DynamicAdjustmentPage() {
  const [records, setRecords] = useState<DynamicAdjustmentRecord[]>([]);
  const [filters, setFilters] = useState({
    adjustmentWaterWell: "",
    trackedOilWell: "",
    adjustmentPurpose: "",
    fromDate: "",
    toDate: "",
  });
  const [form, setForm] = useState<DynamicAdjustmentForm>(() => createEmptyDynamicAdjustmentForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const headClass = "border border-gray-600 bg-white px-2 py-1 text-center text-[13px] font-normal leading-tight text-black";
  const cellClass = "h-8 border border-gray-600 bg-white px-2 py-1 text-center text-[13px] leading-tight text-black";
  const inputClass = "h-8 rounded border border-[#b8c8d8] bg-white px-2 text-[13px] text-[#001a33] outline-none focus:border-cnpc-blue";

  const previewDiffs = calculateDynamicAdjustmentDiffs({
    beforeDailyLiquid: form.beforeDailyLiquid === "" ? null : Number(form.beforeDailyLiquid),
    beforeDailyOil: form.beforeDailyOil === "" ? null : Number(form.beforeDailyOil),
    beforeWaterCut: form.beforeWaterCut === "" ? null : Number(form.beforeWaterCut),
    afterDailyLiquid: form.afterDailyLiquid === "" ? null : Number(form.afterDailyLiquid),
    afterDailyOil: form.afterDailyOil === "" ? null : Number(form.afterDailyOil),
    afterWaterCut: form.afterWaterCut === "" ? null : Number(form.afterWaterCut),
  });

  const loadRecords = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get<DynamicAdjustmentRecord[]>("/api/dynamic-adjustments", {
        params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim())),
      });
      setRecords(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "动态调配记录加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const updateForm = (key: keyof DynamicAdjustmentForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreateForm = (purpose = DYNAMIC_ADJUSTMENT_PURPOSES[0]) => {
    setEditingId(null);
    setForm({ ...createEmptyDynamicAdjustmentForm(), adjustmentPurpose: purpose });
    setShowForm(true);
    setError("");
  };

  const openEditForm = (record: DynamicAdjustmentRecord) => {
    setEditingId(record.id);
    setForm(formFromDynamicAdjustmentRecord(record));
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.adjustmentWaterWell.trim() || !form.adjustmentDate || !form.adjustmentPurpose || !form.trackedOilWell.trim()) {
      setError("请填写调配水井、调配日期、调配目的和井号");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await axios.put(`/api/dynamic-adjustments/${editingId}`, form);
      } else {
        await axios.post("/api/dynamic-adjustments", form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(createEmptyDynamicAdjustmentForm());
      await loadRecords();
    } catch (err: any) {
      setError(err?.response?.data?.error || "动态调配记录保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: DynamicAdjustmentRecord) => {
    if (!window.confirm(`确认删除 ${record.adjustmentWaterWell} / ${record.trackedOilWell} 的动态调配记录？`)) return;
    setError("");
    try {
      await axios.delete(`/api/dynamic-adjustments/${record.id}`);
      await loadRecords();
    } catch (err: any) {
      setError(err?.response?.data?.error || "动态调配记录删除失败");
    }
  };

  const visibleRows = records.length
    ? records
    : DYNAMIC_ADJUSTMENT_PURPOSES.map((purpose) => ({
        id: `empty-${purpose}`,
        adjustmentWaterWell: "",
        injectionProcess: "",
        adjustmentDate: "",
        beforeDailyInjection: null,
        afterDailyInjection: null,
        adjustmentPurpose: purpose,
        trackedOilWell: "",
      }));

  return (
    <PageShell title="动态调配" subtitle="按调配水井、调配目的和重点跟踪油井产量录入动态调配效果。">
      <div className="space-y-3 border border-shell-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#001a33]">
          <input className={`${inputClass} w-28`} placeholder="调配水井" value={filters.adjustmentWaterWell} onChange={(event) => setFilters({ ...filters, adjustmentWaterWell: event.target.value })} />
          <input className={`${inputClass} w-28`} placeholder="井号" value={filters.trackedOilWell} onChange={(event) => setFilters({ ...filters, trackedOilWell: event.target.value })} />
          <select className={`${inputClass} w-36`} value={filters.adjustmentPurpose} onChange={(event) => setFilters({ ...filters, adjustmentPurpose: event.target.value })}>
            <option value="">全部调配目的</option>
            {DYNAMIC_ADJUSTMENT_PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
          </select>
          <input type="date" className={`${inputClass} w-36`} value={filters.fromDate} onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })} />
          <input type="date" className={`${inputClass} w-36`} value={filters.toDate} onChange={(event) => setFilters({ ...filters, toDate: event.target.value })} />
          <button type="button" onClick={loadRecords} className="h-8 rounded border border-[#8aaed3] bg-[#e4f0fa] px-4 text-[13px] font-bold text-[#001a33] hover:bg-[#d6e8f8]">查询</button>
          <button type="button" onClick={() => setFilters({ adjustmentWaterWell: "", trackedOilWell: "", adjustmentPurpose: "", fromDate: "", toDate: "" })} className="h-8 rounded border border-gray-300 bg-white px-4 text-[13px] font-bold text-gray-700 hover:bg-gray-50">重置</button>
          <button type="button" onClick={() => openCreateForm()} className="h-8 rounded bg-cnpc-red px-4 text-[13px] font-bold text-white hover:bg-cnpc-red-dark">新增</button>
        </div>

        {error && <div className="border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="overflow-x-auto bg-white">
          <table className="w-full min-w-[1380px] border-collapse bg-white text-center text-black">
            <thead>
              <tr>
                <th rowSpan={3} className={headClass}>调配水井</th>
                <th rowSpan={3} className={headClass}>分注工艺</th>
                <th rowSpan={3} className={headClass}>调配日期</th>
                <th rowSpan={3} className={headClass}>调配前日注</th>
                <th rowSpan={3} className={headClass}>调配后日注</th>
                <th rowSpan={3} className={headClass}>调配目的</th>
                <th colSpan={12} className={headClass}>重点跟踪油井产量</th>
                <th rowSpan={3} className={headClass}>操作</th>
              </tr>
              <tr>
                <th rowSpan={2} className={headClass}>井号</th>
                <th colSpan={3} className={headClass}>调配前</th>
                <th colSpan={3} className={headClass}>调配后</th>
                <th colSpan={3} className={headClass}>差值</th>
                <th colSpan={2} className={headClass}>阶段效果</th>
              </tr>
              <tr>
                {["日产液", "日产油", "含水", "日产液", "日产油", "含水", "日产液", "日产油", "含水", "阶段天数", "累增油"].map((header, index) => (
                  <th key={`${header}-${index}`} className={headClass}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={19} className={cellClass}>正在加载...</td></tr>
              ) : visibleRows.map((row: any) => (
                <tr key={row.id}>
                  <td className={cellClass}>{row.adjustmentWaterWell}</td>
                  <td className={cellClass}>{row.injectionProcess}</td>
                  <td className={cellClass}>{formatDateOnly(row.adjustmentDate)}</td>
                  <td className={cellClass}>{formatNumberCell(row.beforeDailyInjection)}</td>
                  <td className={cellClass}>{formatNumberCell(row.afterDailyInjection)}</td>
                  <td className={cellClass}>{row.adjustmentPurpose}</td>
                  <td className={cellClass}>{row.trackedOilWell}</td>
                  <td className={cellClass}>{formatNumberCell(row.beforeDailyLiquid)}</td>
                  <td className={cellClass}>{formatNumberCell(row.beforeDailyOil)}</td>
                  <td className={cellClass}>{formatNumberCell(row.beforeWaterCut)}</td>
                  <td className={cellClass}>{formatNumberCell(row.afterDailyLiquid)}</td>
                  <td className={cellClass}>{formatNumberCell(row.afterDailyOil)}</td>
                  <td className={cellClass}>{formatNumberCell(row.afterWaterCut)}</td>
                  <td className={cellClass}>{formatNumberCell(row.diffDailyLiquid)}</td>
                  <td className={cellClass}>{formatNumberCell(row.diffDailyOil)}</td>
                  <td className={cellClass}>{formatNumberCell(row.diffWaterCut)}</td>
                  <td className={cellClass}>{formatNumberCell(row.stageDays)}</td>
                  <td className={cellClass}>{formatNumberCell(row.cumulativeOil)}</td>
                  <td className={cellClass}>
                    {records.length ? (
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => openEditForm(row)} className="font-bold text-[#0000ee] hover:underline">编辑</button>
                        <button type="button" onClick={() => handleDelete(row)} className="font-bold text-red-600 hover:underline">删除</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => openCreateForm(row.adjustmentPurpose)} className="font-bold text-[#0000ee] hover:underline">新增</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto border border-shell-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? "编辑动态调配" : "新增动态调配"}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-gray-500 hover:text-gray-900">关闭</button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <input className={inputClass} placeholder="调配水井" value={form.adjustmentWaterWell} onChange={(event) => updateForm("adjustmentWaterWell", event.target.value)} />
              <input className={inputClass} placeholder="分注工艺" value={form.injectionProcess} onChange={(event) => updateForm("injectionProcess", event.target.value)} />
              <input type="date" className={inputClass} value={form.adjustmentDate} onChange={(event) => updateForm("adjustmentDate", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配前日注" value={form.beforeDailyInjection} onChange={(event) => updateForm("beforeDailyInjection", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配后日注" value={form.afterDailyInjection} onChange={(event) => updateForm("afterDailyInjection", event.target.value)} />
              <select className={inputClass} value={form.adjustmentPurpose} onChange={(event) => updateForm("adjustmentPurpose", event.target.value)}>
                {DYNAMIC_ADJUSTMENT_PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
              </select>
              <input className={inputClass} placeholder="井号" value={form.trackedOilWell} onChange={(event) => updateForm("trackedOilWell", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配前 日产液" value={form.beforeDailyLiquid} onChange={(event) => updateForm("beforeDailyLiquid", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配前 日产油" value={form.beforeDailyOil} onChange={(event) => updateForm("beforeDailyOil", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配前 含水" value={form.beforeWaterCut} onChange={(event) => updateForm("beforeWaterCut", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配后 日产液" value={form.afterDailyLiquid} onChange={(event) => updateForm("afterDailyLiquid", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配后 日产油" value={form.afterDailyOil} onChange={(event) => updateForm("afterDailyOil", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配后 含水" value={form.afterWaterCut} onChange={(event) => updateForm("afterWaterCut", event.target.value)} />
              <input className={inputClass} readOnly value={formatNumberCell(previewDiffs.diffDailyLiquid)} placeholder="差值 日产液" />
              <input className={inputClass} readOnly value={formatNumberCell(previewDiffs.diffDailyOil)} placeholder="差值 日产油" />
              <input className={inputClass} readOnly value={formatNumberCell(previewDiffs.diffWaterCut)} placeholder="差值 含水" />
              <input type="number" className={inputClass} placeholder="阶段天数" value={form.stageDays} onChange={(event) => updateForm("stageDays", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="累增油" value={form.cumulativeOil} onChange={(event) => updateForm("cumulativeOil", event.target.value)} />
            </div>
            <textarea className="mt-3 min-h-20 w-full rounded border border-[#b8c8d8] px-3 py-2 text-sm outline-none focus:border-cnpc-blue" placeholder="备注" value={form.remark} onChange={(event) => updateForm("remark", event.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">取消</button>
              <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-cnpc-red px-4 py-2 text-sm font-bold text-white hover:bg-cnpc-red-dark disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 5: Replace the route placeholder**

In the `renderPage` switch, replace:

```tsx
case "dynamic-adjustment":
  return <PlaceholderPage title="动态调配" />;
```

with:

```tsx
case "dynamic-adjustment":
  return <DynamicAdjustmentPage />;
```

- [ ] **Step 6: Run tests**

Run:

```powershell
npm test
```

Expected: PASS for all dynamic adjustment helper tests.

- [ ] **Step 7: Run TypeScript check**

Run:

```powershell
npm run lint
```

Expected: TypeScript check exits with code 0.

- [ ] **Step 8: Commit frontend if inside a git repository**

Run:

```powershell
git status --short
```

Expected in this workspace: `fatal: not a git repository...`; skip commit here. If implementing from a git repository, commit with:

```powershell
git add src/App.tsx src/shared/dynamicAdjustment.ts tests/dynamicAdjustment.test.ts package.json
git commit -m "feat: build dynamic adjustment page"
```

---

### Task 6: Build And Manual Verification

**Files:**
- No new files.

- [ ] **Step 1: Run all automated checks**

Run:

```powershell
npm test
npm run lint
npm run build
```

Expected:

- `npm test`: all helper tests pass.
- `npm run lint`: TypeScript exits with code 0.
- `npm run build`: Vite build exits with code 0.

- [ ] **Step 2: Start the local app**

Run:

```powershell
npm run dev
```

Expected: server starts on `http://localhost:5000`.

- [ ] **Step 3: Manually verify screenshot consistency**

Open `http://localhost:5000`, navigate to “动态调配”, and verify:

- The visible table headers are `调配水井`, `分注工艺`, `调配日期`, `调配前日注`, `调配后日注`, `调配目的`.
- The center group header is `重点跟踪油井产量`.
- The nested headers are `井号`, `调配前`, `调配后`, `差值`, `阶段效果`.
- The leaf headers are `日产液`, `日产油`, `含水`, `日产液`, `日产油`, `含水`, `日产液`, `日产油`, `含水`, `阶段天数`, `累增油`.
- Empty state shows two rows whose `调配目的` values are `解决污水平衡` and `油井产状变化`.

- [ ] **Step 4: Manually verify CRUD behavior**

In the “动态调配” page:

- Click `新增` and save a record with:
  - 调配水井: `高2-4-055`
  - 分注工艺: `分注`
  - 调配日期: today
  - 调配前日注: `12.5`
  - 调配后日注: `14`
  - 调配目的: `解决污水平衡`
  - 井号: `高2-4-075`
  - 调配前 日产液: `7.2`
  - 调配前 日产油: `3.6`
  - 调配前 含水: `35`
  - 调配后 日产液: `8.1`
  - 调配后 日产油: `4`
  - 调配后 含水: `32`
  - 阶段天数: `30`
  - 累增油: `12`
- Verify table shows the saved record.
- Verify 差值 shows `0.9`, `0.4`, `-3`.
- Edit the record and change 调配后 日产油 to `4.5`.
- Verify 差值 日产油 becomes `0.9`.
- Search by 井号 `高2-4-075`; verify the record remains visible.
- Delete the record; verify the empty-state rows return.

- [ ] **Step 5: Stop the dev server**

Press `Ctrl+C` in the dev server terminal after manual verification.

