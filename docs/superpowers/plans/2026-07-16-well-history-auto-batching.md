# 单井井史 PPT 自动分批导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一次选择大量 PPT/PPTX 时自动按服务端限制拆分请求，确认后串行导入并汇总结果；App 自动批量导入的单文件安全上限为 48MB。

**Architecture:** 在浏览器安全的 `wellHistoryImport` 共享模块中增加纯分批函数，负责数量/体积边界。前端在所有文件范围内先按井号保留最后文件，再生成批次，复用现有批量 API 串行上传并聚合响应；App 使用 48MB 单文件安全上限，服务端及共享模块中的 50MB 绝对常量保持不变。

**Tech Stack:** TypeScript、React、Axios、Node test runner。

---

### Task 1: 实现可测试的文件分批函数

**Files:**
- Modify: `src/shared/wellHistoryImport.ts`
- Modify: `tests/wellHistoryImport.test.ts`

- [ ] **Step 1: 编写失败测试**

新增测试覆盖：

```ts
import {
  createWellHistoryImportBatches,
  WELL_HISTORY_BATCH_MAX_BYTES,
  WELL_HISTORY_BATCH_MAX_FILES,
  WELL_HISTORY_MAX_FILE_BYTES,
} from "../src/shared/wellHistoryImport";

test("createWellHistoryImportBatches respects file count and byte limits", () => {
  const files = Array.from({ length: 21 }, (_, index) => ({ name: `${index}.pptx`, size: 1024 }));
  const result = createWellHistoryImportBatches(files);
  assert.deepEqual(result.batches.map(batch => batch.length), [20, 1]);
  assert.equal(result.oversized.length, 0);
  assert.equal(WELL_HISTORY_BATCH_MAX_FILES, 20);
});

test("createWellHistoryImportBatches starts a new batch before 48MB", () => {
  const result = createWellHistoryImportBatches([
    { name: "a.pptx", size: WELL_HISTORY_BATCH_MAX_BYTES - 10 },
    { name: "b.pptx", size: 20 },
  ]);
  assert.deepEqual(result.batches.map(batch => batch.map(file => file.name)), [["a.pptx"], ["b.pptx"]]);
});

test("createWellHistoryImportBatches reports files larger than 50MB", () => {
  const tooLarge = { name: "large.pptx", size: WELL_HISTORY_MAX_FILE_BYTES + 1 };
  const result = createWellHistoryImportBatches([tooLarge]);
  assert.deepEqual(result.batches, []);
  assert.deepEqual(result.oversized, [tooLarge]);
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- tests/wellHistoryImport.test.ts`

Expected: FAIL，缺少导出。

- [ ] **Step 3: 实现常量和贪心分批**

```ts
export const WELL_HISTORY_BATCH_MAX_FILES = 20;
export const WELL_HISTORY_BATCH_MAX_BYTES = 48 * 1024 * 1024;
export const WELL_HISTORY_MAX_FILE_BYTES = 50 * 1024 * 1024;

export function createWellHistoryImportBatches<T extends { size: number }>(files: T[]) {
  const oversized = files.filter(file => file.size > WELL_HISTORY_MAX_FILE_BYTES);
  const eligible = files.filter(file => file.size <= WELL_HISTORY_MAX_FILE_BYTES);
  const batches: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;
  for (const file of eligible) {
    if (current.length && (current.length >= WELL_HISTORY_BATCH_MAX_FILES || currentBytes + file.size > WELL_HISTORY_BATCH_MAX_BYTES)) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(file);
    currentBytes += file.size;
  }
  if (current.length) batches.push(current);
  return { batches, oversized };
}
```

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `npm test -- tests/wellHistoryImport.test.ts`

Expected: PASS。

### Task 2: 前端建立全局去重与分批计划

**Files:**
- Modify: `src/App.tsx:7430-7490`
- Modify: `tests/appShell.test.ts`

- [ ] **Step 1: 添加共享函数导入和源码契约测试**

`App.tsx` 导入：

```ts
import {
  createWellHistoryImportBatches,
  normalizeWellHistoryWellNo,
  parseWellHistoryImportFileName,
  selectLatestWellHistoryImports,
  WELL_HISTORY_BATCH_MAX_BYTES,
  WELL_HISTORY_BATCH_MAX_FILES,
} from "./shared/wellHistoryImport";
```

契约测试断言源码包含 `createWellHistoryImportBatches`、`selectLatestWellHistoryImports` 和分批状态模板。

- [ ] **Step 2: 将选择文件映射为全局去重项**

```ts
const candidates = pptFiles.map((file, sourceOrder) => {
  const parsed = parseWellHistoryImportFileName(file.name);
  const normalized = normalizeWellHistoryWellNo(parsed.wellNo);
  return {
    file,
    size: file.size,
    sourceOrder,
    sourceOriginalName: file.name,
    wellNo: normalized || `__invalid_${sourceOrder}`,
    resultWellNo: normalized,
  };
});
const { selected, superseded } = selectLatestWellHistoryImports(candidates);
const { batches } = createWellHistoryImportBatches(selected);
const unbatchable = selected.filter(candidate => candidate.size > WELL_HISTORY_BATCH_MAX_BYTES);
```

`superseded` 预先形成前端汇总项，使用真实 `resultWellNo`，不发送到服务端。

- [ ] **Step 3: 超限文件阻止上传**

若 `unbatchable.length > 0`，用现有确认弹窗列出文件名并说明 App 自动分批单文件安全上限为 48MB，仅提供关闭，不调用上传执行函数，并清空 input。共享的 50MB 常量仅作为服务端绝对上限保留，不用于放宽 App 安全上限。

- [ ] **Step 4: 超过单批限制时请求确认**

判断原始 `pptFiles.length > WELL_HISTORY_BATCH_MAX_FILES` 或总字节数 `> WELL_HISTORY_BATCH_MAX_BYTES`。消息包含原始文件数、去重后文件数和 `batches.length`。确认回调调用实际执行函数；未超限直接执行。

### Task 3: 串行上传并聚合进度/结果

**Files:**
- Modify: `src/App.tsx:7430-7500`
- Modify: `tests/appShell.test.ts`

- [ ] **Step 1: 提取 `executeBatchImport`**

函数接收 `batches`、原始总文件数和前端 superseded 项。初始化聚合结果：

```ts
const aggregate = {
  successCount: 0,
  supersededCount: supersededItems.length,
  failureCount: 0,
  items: [...supersededItems],
};
```

- [ ] **Step 2: 串行发送每批**

使用 `for (const [batchIndex, batch] of batches.entries())`，每批新建 FormData，仅添加该批 `candidate.file`。状态更新为：

```ts
setImportStatus(`正在导入第 ${batchIndex + 1}/${batches.length} 批...`);
```

上传进度折算：

```ts
const fraction = event.total ? event.loaded / event.total : 0;
setImportProgress(Math.round(((batchIndex + fraction) / batches.length) * 100));
```

响应成功时累加三个 count 和 items。

- [ ] **Step 3: 单批请求失败后继续**

捕获该批 axios 错误，为该批每个文件追加 `{ fileName, wellNo: resultWellNo, status: "batch-request-failed", message }`，`failureCount += batch.length`，然后继续循环。

- [ ] **Step 4: 完成后统一刷新和提示**

循环结束后设置进度 100、根据 failureCount 设置状态、调用一次 `loadArchives()`，并用原始总文件数展示成功/覆盖跳过/失败汇总。汇总弹窗的确认和取消回调都复用 `openFirstSuccess`，确保弹窗关闭后才打开 aggregate.items 中第一条 success；若存在未保存内容，再由正常切井确认处理。finally 清理 importing 和 file input。

- [ ] **Step 5: 验证前端契约**

Run: `npm test -- tests/appShell.test.ts && npm run lint`

Expected: PASS。

### Task 4: 全量验证

**Files:**
- Modify only if verification exposes a directly related defect.

- [ ] **Step 1: 运行测试**

Run: `npm test`

Expected: 0 failures。

- [ ] **Step 2: 类型和构建**

Run: `npm run lint && npm run build`

Expected: exit code 0；允许现有 bundle size warning。

- [ ] **Step 3: 差异检查**

Run: `git diff --check`

Expected: 无输出。
