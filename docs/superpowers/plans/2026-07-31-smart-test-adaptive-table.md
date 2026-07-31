# 智能测调井史自适应表格 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让智能测调井史根据浏览器可用高度动态请求并显示 10–25 行记录，减少大屏空白并保持现有服务端分页。

**Architecture:** 在 `secondBatchRecords` 共享模块增加两个纯函数：计算视口可容纳行数、在 pageSize 变化时映射当前页。`SmartTestHistoryPage` 使用稳定 ref 保存当前分页/筛选状态，监听窗口 resize，仅在计算值变化时重新请求；表格宽度和横向滚动保持不变。

**Tech Stack:** React 19、TypeScript、Axios、Node test runner、Vite、Playwright CLI。

---

## 文件结构

- 修改 `src/shared/secondBatchRecords.ts`：增加自适应 pageSize 与页码映射纯函数。
- 修改 `tests/secondBatchRecords.test.ts`：覆盖最小/常规/最大视口和页码保持。
- 新建 `tests/smartTestAdaptiveTable.test.ts`：锁定智能测调页面已接入动态 pageSize，且不再固定 10 行。
- 修改 `src/App.tsx:1686-1845`：接入自适应分页和 resize 监听。

### Task 1: 实现可测试的自适应计算

**Files:**
- Modify: `src/shared/secondBatchRecords.ts`
- Test: `tests/secondBatchRecords.test.ts`

- [ ] **Step 1: 写入失败测试**

```ts
import {
  calculateAdaptiveTablePageSize,
  mapPageForPageSizeChange,
} from "../src/shared/secondBatchRecords";

test("calculateAdaptiveTablePageSize fills available viewport height within limits", () => {
  assert.equal(calculateAdaptiveTablePageSize({ viewportHeight: 900, tableTop: 80 }), 15);
  assert.equal(calculateAdaptiveTablePageSize({ viewportHeight: 1080, tableTop: 80 }), 19);
  assert.equal(calculateAdaptiveTablePageSize({ viewportHeight: 500, tableTop: 80 }), 10);
  assert.equal(calculateAdaptiveTablePageSize({ viewportHeight: 2000, tableTop: 80 }), 25);
  assert.equal(calculateAdaptiveTablePageSize({ viewportHeight: Number.NaN, tableTop: 80 }), 10);
});

test("mapPageForPageSizeChange keeps the first visible record nearby", () => {
  assert.equal(mapPageForPageSizeChange(3, 10, 15), 2);
  assert.equal(mapPageForPageSizeChange(2, 15, 10), 2);
  assert.equal(mapPageForPageSizeChange(0, 0, 0), 1);
});
```

- [ ] **Step 2: 运行定向测试确认红灯**

Run: `npx tsx --test tests/secondBatchRecords.test.ts`

Expected: FAIL，两个函数尚未导出。

- [ ] **Step 3: 实现最小纯函数**

```ts
type AdaptiveTablePageSizeInput = {
  viewportHeight: number;
  tableTop: number;
  reservedHeight?: number;
  rowHeight?: number;
  minRows?: number;
  maxRows?: number;
};

export function calculateAdaptiveTablePageSize({
  viewportHeight,
  tableTop,
  reservedHeight = 184,
  rowHeight = 41,
  minRows = 10,
  maxRows = 25,
}: AdaptiveTablePageSizeInput) {
  if (![viewportHeight, tableTop, reservedHeight, rowHeight].every(Number.isFinite) || rowHeight <= 0) return minRows;
  const rows = Math.floor((viewportHeight - tableTop - reservedHeight) / rowHeight);
  return Math.min(maxRows, Math.max(minRows, rows));
}

export function mapPageForPageSizeChange(currentPage: number, currentPageSize: number, nextPageSize: number) {
  const safePage = Number.isFinite(currentPage) && currentPage > 0 ? Math.floor(currentPage) : 1;
  const safeCurrentSize = Number.isFinite(currentPageSize) && currentPageSize > 0 ? Math.floor(currentPageSize) : 10;
  const safeNextSize = Number.isFinite(nextPageSize) && nextPageSize > 0 ? Math.floor(nextPageSize) : 10;
  const firstVisibleIndex = (safePage - 1) * safeCurrentSize;
  return Math.floor(firstVisibleIndex / safeNextSize) + 1;
}
```

- [ ] **Step 4: 运行定向测试确认绿灯**

Run: `npx tsx --test tests/secondBatchRecords.test.ts`

Expected: 全部 PASS。

### Task 2: 接入智能测调页面

**Files:**
- Modify: `src/App.tsx:55-75`
- Modify: `src/App.tsx:1686-1845`
- Create: `tests/smartTestAdaptiveTable.test.ts`

- [ ] **Step 1: 写入集成合同失败测试**

新测试读取 `src/App.tsx` 中 `SmartTestHistoryPage` 函数体，并验证：

```ts
assert.match(smartPageSource, /calculateAdaptiveTablePageSize/);
assert.match(smartPageSource, /mapPageForPageSizeChange/);
assert.match(smartPageSource, /addEventListener\("resize"/);
assert.match(smartPageSource, /pageSize:\s*requestedPageSize/);
assert.doesNotMatch(smartPageSource, /const pageSize = 10/);
```

- [ ] **Step 2: 运行集成测试确认红灯**

Run: `npx tsx --test tests/smartTestAdaptiveTable.test.ts`

Expected: FAIL，页面仍固定 `const pageSize = 10`。

- [ ] **Step 3: 导入共享函数并建立动态状态**

在现有 `secondBatchRecords` import 中加入两个函数。将固定常量替换为：

```tsx
const tablePageRef = useRef<HTMLDivElement>(null);
const [pageSize, setPageSize] = useState(() => calculateAdaptiveTablePageSize({
  viewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
  tableTop: 80,
}));
const pageSizeRef = useRef(pageSize);
const currentPageRef = useRef(1);
const filtersRef = useRef(filters);
```

在 render 周期同步三个 ref，供 resize 回调和异步请求读取最新值。

- [ ] **Step 4: 让请求接受显式 pageSize**

将 `loadRecords` 改为稳定的 `useCallback`：

```tsx
const loadRecords = useCallback(async (
  page = currentPageRef.current,
  nextFilters = filtersRef.current,
  requestedPageSize = pageSizeRef.current,
) => {
  const params = Object.fromEntries(
    Object.entries({ ...nextFilters, page, pageSize: requestedPageSize })
      .filter(([, value]) => String(value).trim()),
  );
  const { data } = await axios.get<PaginatedApiResponse<SmartTestRecord>>("/api/smart-test-records", { params });
  setRecords(data.rows);
  setTotalItems(data.total);
  setCurrentPage(data.page);
  currentPageRef.current = data.page;
  setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
}, []);
```

保留现有 try/catch 和错误文案。

- [ ] **Step 5: 监听视口高度变化**

增加一个只挂载一次的 effect：

```tsx
useEffect(() => {
  let frame = 0;
  const updatePageSize = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const nextPageSize = calculateAdaptiveTablePageSize({
        viewportHeight: window.innerHeight,
        tableTop: tablePageRef.current?.getBoundingClientRect().top ?? 80,
      });
      const previousPageSize = pageSizeRef.current;
      if (nextPageSize === previousPageSize) return;
      const nextPage = mapPageForPageSizeChange(currentPageRef.current, previousPageSize, nextPageSize);
      pageSizeRef.current = nextPageSize;
      setPageSize(nextPageSize);
      void loadRecords(nextPage, filtersRef.current, nextPageSize);
    });
  };
  updatePageSize();
  window.addEventListener("resize", updatePageSize);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", updatePageSize);
  };
}, [loadRecords]);
```

用 `<div ref={tablePageRef}>` 包裹现有 `ZonalTableShell`。不修改 1820px 最小宽度和横向滚动。

- [ ] **Step 6: 运行定向和全量验证**

Run: `npx tsx --test tests/secondBatchRecords.test.ts tests/smartTestAdaptiveTable.test.ts && npm test && npm run lint && npm run build && git diff --check`

Expected: 全部退出码 0。

### Task 3: 浏览器视觉和分页验收

**Files:**
- Verify: `src/App.tsx`
- Verify: `output/playwright/smart-test-adaptive-900.png`
- Verify: `output/playwright/smart-test-adaptive-1080.png`

- [ ] **Step 1: 900px 高度验收**

打开 `/?page=smart-test-history`，确认 API 请求的 `pageSize` 约为 15、页面显示多于 10 行、下方空白明显减少。

- [ ] **Step 2: 1080px 高度验收**

将视口增高到 1080px，确认 pageSize 增加到约 19，分页总页数随之重算且数据无重复。

- [ ] **Step 3: 窄屏验收**

确认表格仍在自身容器内横向滚动，页面本身不出现失控横向溢出。

- [ ] **Step 4: 提交**

```bash
git add src/shared/secondBatchRecords.ts src/App.tsx tests/secondBatchRecords.test.ts tests/smartTestAdaptiveTable.test.ts
git commit -m "feat: adapt smart test table to viewport height"
```
