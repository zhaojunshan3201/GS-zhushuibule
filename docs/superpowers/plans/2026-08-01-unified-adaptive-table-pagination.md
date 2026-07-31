# Unified Adaptive Table Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ten designated business tables use one 10–25-row viewport-adaptive pagination system while preserving server pagination, filters, CRUD flows, charts, and internal horizontal scrolling.

**Architecture:** Add a focused React hook that owns `currentPage`, `pageSize`, the measurable page container ref, resize/animation-frame cleanup, and first-record page mapping. Keep data loading inside each page: nine server-paginated pages request the hook's current `pageSize` and ignore stale responses, while Dynamic Adjustment continues client-side slicing without a resize fetch.

**Tech Stack:** React 19 hooks, TypeScript 5.8, Axios, Node test runner through `tsx --test`, TypeScript compiler, Vite, Playwright CLI.

---

## File Structure

- Create `src/shared/adaptiveTablePagination.ts`: shared React hook and public types.
- Create `tests/adaptiveTablePagination.test.ts`: lifecycle contract for the hook.
- Create `tests/adaptiveTablePages.test.ts`: AST-scoped integration contracts for the ten page functions.
- Modify `src/App.tsx`: replace fixed page sizes, pass dynamic sizes to server requests, add latest-request guards, and attach measurable refs.
- Modify `tests/smartTestAdaptiveTable.test.ts`: assert shared-hook integration instead of local resize implementation.

The existing pure functions stay in `src/shared/secondBatchRecords.ts`; moving them is outside this change.

---

### Task 1: Add the shared adaptive pagination hook

**Files:**
- Create: `src/shared/adaptiveTablePagination.ts`
- Create: `tests/adaptiveTablePagination.test.ts`
- Test: `tests/secondBatchRecords.test.ts`

- [ ] **Step 1: Write the failing lifecycle contract**

Create `tests/adaptiveTablePagination.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hookUrl = new URL("../src/shared/adaptiveTablePagination.ts", import.meta.url);
const readHookSource = () => readFile(hookUrl, "utf8").catch(() => "");

test("useAdaptiveTablePagination owns page state and resize cleanup", async () => {
  const source = await readHookSource();
  assert.match(source, /export function useAdaptiveTablePagination/);
  assert.match(source, /calculateAdaptiveTablePageSize\s*\(/);
  assert.match(source, /mapPageForPageSizeChange\s*\(/);
  assert.match(source, /addEventListener\(\s*["']resize["']/);
  assert.match(source, /removeEventListener\(\s*["']resize["']/);
  assert.match(source, /requestAnimationFrame\s*\(/);
  assert.match(source, /cancelAnimationFrame\s*\(/);
  assert.match(source, /currentPageRef/);
  assert.match(source, /pageSizeRef/);
});
```

- [ ] **Step 2: Run RED**

Run:

```powershell
npx tsx --test tests/adaptiveTablePagination.test.ts
```

Expected: FAIL on the missing exported hook.

- [ ] **Step 3: Implement the hook**

Create `src/shared/adaptiveTablePagination.ts`:

```ts
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  calculateAdaptiveTablePageSize,
  mapPageForPageSizeChange,
} from "./secondBatchRecords";

export type AdaptiveTablePaginationOptions = {
  initialPage?: number;
  fallbackTableTop?: number;
  reservedHeight?: number;
  rowHeight?: number;
  minRows?: number;
  maxRows?: number;
};

type AdaptivePaginationState = { currentPage: number; pageSize: number };

export function useAdaptiveTablePagination({
  initialPage = 1,
  fallbackTableTop = 80,
  reservedHeight = 184,
  rowHeight = 41,
  minRows = 10,
  maxRows = 25,
}: AdaptiveTablePaginationOptions = {}) {
  const tablePageRef = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState<AdaptivePaginationState>(() => ({
    currentPage: initialPage,
    pageSize: calculateAdaptiveTablePageSize({
      viewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
      tableTop: fallbackTableTop,
      reservedHeight,
      rowHeight,
      minRows,
      maxRows,
    }),
  }));
  const currentPageRef = useRef(pagination.currentPage);
  const pageSizeRef = useRef(pagination.pageSize);

  currentPageRef.current = pagination.currentPage;
  pageSizeRef.current = pagination.pageSize;

  const setCurrentPage = useCallback<Dispatch<SetStateAction<number>>>((action) => {
    setPagination((current) => {
      const currentPage = typeof action === "function" ? action(current.currentPage) : action;
      currentPageRef.current = currentPage;
      return { ...current, currentPage };
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let resizeFrame: number | null = null;
    const updatePageSize = () => {
      resizeFrame = null;
      const nextPageSize = calculateAdaptiveTablePageSize({
        viewportHeight: window.innerHeight,
        tableTop: tablePageRef.current?.getBoundingClientRect().top ?? fallbackTableTop,
        reservedHeight,
        rowHeight,
        minRows,
        maxRows,
      });
      setPagination((current) => {
        if (current.pageSize === nextPageSize) return current;
        const currentPage = mapPageForPageSizeChange(current.currentPage, current.pageSize, nextPageSize);
        currentPageRef.current = currentPage;
        pageSizeRef.current = nextPageSize;
        return { currentPage, pageSize: nextPageSize };
      });
    };
    const handleResize = () => {
      if (resizeFrame !== null) return;
      resizeFrame = window.requestAnimationFrame(updatePageSize);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    };
  }, [fallbackTableTop, maxRows, minRows, reservedHeight, rowHeight]);

  return {
    currentPage: pagination.currentPage,
    setCurrentPage,
    pageSize: pagination.pageSize,
    tablePageRef,
    currentPageRef,
    pageSizeRef,
  };
}
```

- [ ] **Step 4: Run GREEN and helper regression tests**

```powershell
npx tsx --test tests/adaptiveTablePagination.test.ts tests/secondBatchRecords.test.ts
npm run lint
```

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```powershell
git diff --check
git add src/shared/adaptiveTablePagination.ts tests/adaptiveTablePagination.test.ts
git commit -m "feat: add shared adaptive table pagination hook"
```

---

### Task 2: Migrate the four history/evaluation tables

**Files:**
- Modify: `src/App.tsx:61-82,1439-2158,2454-2600`
- Create: `tests/adaptiveTablePages.test.ts`
- Modify: `tests/smartTestAdaptiveTable.test.ts`

Pages: `ConcentricTestHistoryPage`, `SmartTestHistoryPage`, `SingleWellInjectionEvaluationPage`, `SingleWellSealEvaluationPage`.

- [ ] **Step 1: Write failing page contracts**

Create `tests/adaptiveTablePages.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const appUrl = new URL("../src/App.tsx", import.meta.url);

function getFunctionSource(source: string, functionName: string) {
  const ast = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const page = ast.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === functionName,
  );
  assert.ok(page, `${functionName} must exist`);
  return source.slice(page.getStart(ast), page.getEnd());
}

test("history and evaluation tables use shared adaptive pagination", async () => {
  const source = await readFile(appUrl, "utf8");
  for (const pageName of [
    "ConcentricTestHistoryPage",
    "SmartTestHistoryPage",
    "SingleWellInjectionEvaluationPage",
    "SingleWellSealEvaluationPage",
  ]) {
    const pageSource = getFunctionSource(source, pageName);
    assert.match(pageSource, /useAdaptiveTablePagination\s*\(/);
    assert.match(pageSource, /pageSize\s*:\s*requestedPageSize/);
    assert.match(pageSource, /loadRequestIdRef/);
    assert.match(pageSource, /ref=\{tablePageRef\}/);
    assert.doesNotMatch(pageSource, /const\s+pageSize\s*=\s*(10|15|30)\b/);
  }
});
```

Update `tests/smartTestAdaptiveTable.test.ts`: assert `useAdaptiveTablePagination`, `pageSize: requestedPageSize`, `ref={tablePageRef}`, the stale-response guard, and retained `min-w-[1820px]`; remove local-listener assertions.

- [ ] **Step 2: Run RED**

```powershell
npx tsx --test tests/adaptiveTablePages.test.ts tests/smartTestAdaptiveTable.test.ts
```

Expected: FAIL because three pages remain fixed and Smart Test still owns local resize code.

- [ ] **Step 3: Apply the hook to all four functions**

Add:

```ts
import { useAdaptiveTablePagination } from "./shared/adaptiveTablePagination";
```

In each page, after its filter state, use:

```ts
const {
  currentPage,
  setCurrentPage,
  pageSize,
  tablePageRef,
  currentPageRef,
  pageSizeRef,
} = useAdaptiveTablePagination();
const filtersRef = useRef(filters);
const loadRequestIdRef = useRef(0);
filtersRef.current = filters;
```

Remove each fixed `pageSize`; remove Smart Test's local page-size state, resize refs, and resize effect.

- [ ] **Step 4: Make every load explicit and race-safe**

In every function, change the loader declaration and request setup to:

```ts
const loadRecords = useCallback(async (
  page = currentPageRef.current,
  nextFilters = filtersRef.current,
  requestedPageSize = pageSizeRef.current,
) => {
  const requestId = ++loadRequestIdRef.current;
  try {
    setError("");
    const params = Object.fromEntries(
      Object.entries({ ...nextFilters, page, pageSize: requestedPageSize })
        .filter(([, value]) => String(value).trim()),
    );
    const { data } = await axios.get<PaginatedApiResponse<SmartTestRecord>>("/api/smart-test-records", { params });
    if (requestId !== loadRequestIdRef.current) return;
    setRecords(data.rows);
    setTotalItems(data.total);
    setCurrentPage(data.page);
    setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
  } catch (err: any) {
    if (requestId !== loadRequestIdRef.current) return;
    setError(err?.response?.data?.error || "智能测调记录加载失败");
  }
}, [setCurrentPage]);
```

The code block is the exact Smart Test implementation. In the other three functions, replace only its request line and fallback line with the exact entries below; all request-ID checks and state updates stay identical:

| Function | record type | route | fallback |
|---|---|---|---|
| Concentric | `ConcentricTestRecord` | `/api/concentric-test-records` | `同心测调记录加载失败` |
| Smart | `SmartTestRecord` | `/api/smart-test-records` | `智能测调记录加载失败` |
| Injection evaluation | `SingleWellInjectionEvaluationRecord` | `/api/single-well-injection-evaluations` | `单井注入评价加载失败` |
| Seal evaluation | `SingleWellSealEvaluationRecord` | `/api/single-well-seal-evaluations` | `单井密封评价加载失败` |

Use one page-size-driven effect per page:

```ts
useEffect(() => {
  void loadRecords(currentPageRef.current, filtersRef.current, pageSize);
}, [loadRecords, pageSize]);
```

Existing filter, CRUD, and page actions continue calling `loadRecords` explicitly.

- [ ] **Step 5: Attach measurable wrappers**

Wrap each existing `ZonalTableShell` in `<div ref={tablePageRef}>`. Continue passing `currentPage`, dynamic `pageSize`, `totalItems`, and `onPageChange={(page) => loadRecords(page)}`. Preserve every existing table width class.

- [ ] **Step 6: Verify and commit**

```powershell
npx tsx --test tests/adaptiveTablePages.test.ts tests/smartTestAdaptiveTable.test.ts
npm test
npm run lint
git diff --check
git add src/App.tsx tests/adaptiveTablePages.test.ts tests/smartTestAdaptiveTable.test.ts
git commit -m "feat: adapt history tables to viewport height"
```

---

### Task 3: Migrate Abnormal Wells and Well Flushing

**Files:**
- Modify: `src/App.tsx:2159-2453,3376-3840`
- Modify: `tests/adaptiveTablePages.test.ts`

- [ ] **Step 1: Add the failing contract**

Append:

```ts
test("abnormal-well and well-flushing tables use adaptive server pagination", async () => {
  const source = await readFile(appUrl, "utf8");
  for (const pageName of ["AbnormalWellsPage", "WellFlushingPage"]) {
    const pageSource = getFunctionSource(source, pageName);
    assert.match(pageSource, /useAdaptiveTablePagination\s*\(/);
    assert.match(pageSource, /pageSize\s*:\s*requestedPageSize/);
    assert.match(pageSource, /loadRequestIdRef/);
    assert.match(pageSource, /ref=\{tablePageRef\}/);
  }
  assert.doesNotMatch(source, /const\s+WELL_FLUSHING_PAGE_SIZE\s*=\s*15/);
});
```

- [ ] **Step 2: Run RED**

```powershell
npx tsx --test tests/adaptiveTablePages.test.ts
```

Expected: FAIL on both fixed-size pages.

- [ ] **Step 3: Replace pagination state and constants**

Use the six-value hook destructuring from Task 2 in both pages. Remove `WELL_FLUSHING_PAGE_SIZE`. Keep `totalPages` based on dynamic `pageSize`. Add filter and request-id refs.

- [ ] **Step 4: Preserve loading behavior while guarding responses**

Change each loader to `(page, nextFilters, requestedPageSize)` defaults from the hook refs. Send `pageSize: requestedPageSize`. Before success state updates and before error updates, return when `requestId !== loadRequestIdRef.current`. In `finally`, call `setLoading(false)` only for the latest request. Use `AbnormalWellRecord` with `/api/abnormal-well-records`, and `WellFlushingRecord` with `/api/well-flushing-records`.

Use the Task 2 page-size effect and attach `ref={tablePageRef}` to each existing top-level table page container.

- [ ] **Step 5: Verify and commit**

```powershell
npx tsx --test tests/adaptiveTablePages.test.ts
npm test
npm run lint
git diff --check
git add src/App.tsx tests/adaptiveTablePages.test.ts
git commit -m "feat: adapt operational tables to viewport height"
```

---

### Task 4: Migrate Injection Technology and Water Cut

**Files:**
- Modify: `src/App.tsx:3842-4953`
- Modify: `tests/adaptiveTablePages.test.ts`

- [ ] **Step 1: Add failing contracts**

```ts
test("injection-tech and water-cut main tables use adaptive pagination", async () => {
  const source = await readFile(appUrl, "utf8");
  for (const pageName of ["InjectionTechPage", "WaterCutPage"]) {
    const pageSource = getFunctionSource(source, pageName);
    assert.match(pageSource, /useAdaptiveTablePagination\s*\(/);
    assert.match(pageSource, /pageSize\s*:\s*requestedPageSize/);
    assert.match(pageSource, /loadRequestIdRef/);
    assert.match(pageSource, /ref=\{tablePageRef\}/);
  }
  assert.doesNotMatch(source, /const\s+INJECTION_TECH_PAGE_SIZE\s*=\s*15/);
  assert.doesNotMatch(source, /const\s+WATER_CUT_PAGE_SIZE\s*=\s*30/);
});
```

- [ ] **Step 2: Run RED**

```powershell
npx tsx --test tests/adaptiveTablePages.test.ts
```

Expected: FAIL on both constants and missing hook calls.

- [ ] **Step 3: Replace constants and calculations**

Remove both fixed constants. Use the shared hook in each function. Change total pages, sequence numbers, and Injection Technology's pinned-row `.slice` to dynamic `pageSize`:

```ts
const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
const rowNumber = (currentPage - 1) * pageSize + index + 1;
const displayedRecords = pinnedRecords.slice(0, pageSize);
```

Keep Water Cut's trend query `pageSize: 50`; it is not the main table.

- [ ] **Step 4: Make main loads explicit and race-safe**

For Injection Technology use `InjectionTechRecord`, `/api/injection-tech-records`, `appliedFiltersRef`, and fallback `注水工艺记录加载失败`. For Water Cut use `WaterCutRecord`, `/api/water-cuts`, `appliedFiltersRef`, and fallback `含水化验记录加载失败`. Each loader accepts `requestedPageSize`, sends it as main-table `pageSize`, ignores stale success/error responses, and clears loading only for the latest request.

Replace the current page/filter effect with:

```ts
useEffect(() => {
  void loadRecords(currentPage, appliedFilters, pageSize);
}, [appliedFilters, currentPage, loadRecords, pageSize]);
```

Attach `ref={tablePageRef}` to each main page wrapper. Keep imports, chart dialogs, chart requests, and CRUD behavior unchanged.

- [ ] **Step 5: Verify and commit**

```powershell
npx tsx --test tests/adaptiveTablePages.test.ts
npm test
npm run lint
git diff --check
git add src/App.tsx tests/adaptiveTablePages.test.ts
git commit -m "feat: adapt monitoring tables to viewport height"
```

---

### Task 5: Migrate Indicator Curve and Dynamic Adjustment

**Files:**
- Modify: `src/App.tsx:2756-3375,7956-8255`
- Modify: `tests/adaptiveTablePages.test.ts`

- [ ] **Step 1: Add failing server/client pagination contracts**

```ts
test("indicator-curve and dynamic-adjustment tables share adaptive page state", async () => {
  const source = await readFile(appUrl, "utf8");
  const indicatorSource = getFunctionSource(source, "IndicatorCurvePage");
  const adjustmentSource = getFunctionSource(source, "DynamicAdjustmentPage");
  assert.match(indicatorSource, /useAdaptiveTablePagination\s*\(/);
  assert.match(indicatorSource, /pageSize\s*:\s*requestedPageSize/);
  assert.match(indicatorSource, /loadRequestIdRef/);
  assert.match(indicatorSource, /length:\s*Math\.max\(0,\s*pageSize\s*-\s*records\.length\)/);
  assert.match(indicatorSource, /ref=\{tablePageRef\}/);
  assert.match(adjustmentSource, /useAdaptiveTablePagination\s*\(/);
  assert.match(adjustmentSource, /slice\(\s*\(displayPage\s*-\s*1\)\s*\*\s*pageSize,\s*displayPage\s*\*\s*pageSize/);
  assert.match(adjustmentSource, /ref=\{tablePageRef\}/);
});
```

- [ ] **Step 2: Run RED**

```powershell
npx tsx --test tests/adaptiveTablePages.test.ts
```

Expected: FAIL because both functions still own fixed 15-row state.

- [ ] **Step 3: Adapt Indicator Curve's main request**

Use the shared hook. Keep option/chart requests at `pageSize: 200`. Change the paginated query builder to accept `requestedPageSize` and pass it as `pageSize`. Add a request ID guard to the main-table response and error. Make its main load effect depend on `currentPage`, `appliedFilters`, and `pageSize`.

Change blank-row creation to:

```tsx
{Array.from({ length: Math.max(0, pageSize - records.length) }, (_, index) => (
  <tr key={`empty-${index}`} aria-hidden="true">
    {headers.map((header) => (
      <td key={`${header}-${index}`} className={cellClass}>&nbsp;</td>
    ))}
  </tr>
))}
```

Attach the measurable ref to the existing page wrapper.

- [ ] **Step 4: Adapt Dynamic Adjustment without refetching**

Use:

```ts
const { currentPage, setCurrentPage, pageSize, tablePageRef } = useAdaptiveTablePagination();
```

Remove fixed `pageSize` and preserve client slicing:

```ts
const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
const displayPage = Math.min(currentPage, totalPages);
const pagedRows = visibleRows.slice(
  (displayPage - 1) * pageSize,
  displayPage * pageSize,
);
```

Attach `ref={tablePageRef}` to the main wrapper. Do not add `pageSize` to Dynamic Adjustment requests or load effects.

- [ ] **Step 5: Verify and commit**

```powershell
npx tsx --test tests/adaptiveTablePages.test.ts
npm test
npm run lint
git diff --check
git add src/App.tsx tests/adaptiveTablePages.test.ts
git commit -m "feat: adapt analysis tables to viewport height"
```

---

### Task 6: Full regression and real-browser verification

**Files:**
- Modify only if a regression test exposes a defect: `src/App.tsx`, `src/shared/adaptiveTablePagination.ts`, or the directly related test.
- Create visual evidence under `output/playwright/unified-adaptive-tables/`.

- [ ] **Step 1: Run full automated verification**

```powershell
npm test
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, TypeScript and Vite exit 0, and the existing large-chunk warning is non-blocking.

- [ ] **Step 2: Open a real browser**

```powershell
Get-Command npx
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables open http://127.0.0.1:5000 --headed
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables snapshot
```

Expected: the app opens and a fresh snapshot exposes sidebar refs.

- [ ] **Step 3: Verify all ten pages at two heights**

Navigate via fresh sidebar snapshots to: 智能测调井史、同心测调井史、单井注入评价、单井密封评价、含水化验、注水工艺、水井洗井、异常水井、动态调配、指示曲线.

On every page run:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables resize 1600 900
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables eval "() => ({ rows: document.querySelectorAll('tbody tr:not([aria-hidden=true])').length, bodyWidth: document.body.clientWidth, bodyScrollWidth: document.body.scrollWidth })"
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables resize 1920 1080
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables eval "() => ({ rows: document.querySelectorAll('tbody tr:not([aria-hidden=true])').length, bodyWidth: document.body.clientWidth, bodyScrollWidth: document.body.scrollWidth })"
```

Expected with sufficient data: about 15 rows at 900px and about 19 rows at 1080px. With less data, the count equals real records. `bodyWidth === bodyScrollWidth`.

- [ ] **Step 4: Verify mapping and internal horizontal scrolling**

On a page with two pages, open page 2 at 1920×1080, record the first sequence number, resize to 1280×900, and run:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables eval "() => ({ first: document.querySelector('tbody tr:not([aria-hidden=true]) td')?.textContent?.trim(), bodyWidth: document.body.clientWidth, bodyScrollWidth: document.body.scrollWidth, scrollers: [...document.querySelectorAll('*')].filter((element) => element.scrollWidth > element.clientWidth + 1 && ['auto','scroll'].includes(getComputedStyle(element).overflowX)).map((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth })).slice(0, 5) })"
```

Expected: the old first record remains visible on the remapped page, body widths match, and a wide table container has `scrollWidth > clientWidth`.

- [ ] **Step 5: Capture evidence and inspect errors/requests**

```powershell
New-Item -ItemType Directory -Force output/playwright/unified-adaptive-tables
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables screenshot --filename output/playwright/unified-adaptive-tables/900px.png
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables resize 1920 1080
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables screenshot --filename output/playwright/unified-adaptive-tables/1080px.png
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables console error
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables requests
npx --yes --package @playwright/cli playwright-cli -s=adaptive-tables close
```

Expected: relevant APIs return 200 and adaptive pagination adds no console error.

- [ ] **Step 6: Commit only regression fixes**

If verification finds a defect, add a failing regression test first, observe RED, implement the minimum fix, rerun the full suite, and commit the directly related files. If no defect appears, do not create an empty commit.

---

## Completion Checklist

- [ ] All ten pages use `useAdaptiveTablePagination`.
- [ ] All main tables use 10–25 adaptive rows.
- [ ] Nine server-paginated pages pass explicit sizes and ignore stale responses.
- [ ] Dynamic Adjustment does not refetch on resize.
- [ ] Water Cut trend and Indicator Curve chart/option requests retain original larger limits.
- [ ] Filter, add, delete, page navigation, and selection behavior remain intact.
- [ ] Wide tables scroll internally without body overflow.
- [ ] Full tests, TypeScript, build, and browser verification pass.
