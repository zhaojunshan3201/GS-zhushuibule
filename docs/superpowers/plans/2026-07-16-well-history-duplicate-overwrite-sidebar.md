# 单井井史重复覆盖与侧边栏调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同批次重复井号仅导入最后一个文件，并把井史正文顶部的查询与操作栏迁入左侧栏。

**Architecture:** 在 `wellHistoryImport` 共享模块增加纯函数，按规范化井号把上传项拆分为待处理文件和被覆盖文件；服务端路由使用该结果执行 COM 导入并返回覆盖计数。前端仅调整现有 JSX 位置，复用所有状态和事件处理函数，不新增业务状态。

**Tech Stack:** TypeScript、React、Express、Node test runner、Tailwind CSS。

---

### Task 1: 同批次重复井号选择最后一个文件

**Files:**
- Modify: `src/shared/wellHistoryImport.ts`
- Modify: `tests/wellHistoryImport.test.ts`

- [ ] **Step 1: 编写失败测试**

```ts
import { selectLatestWellHistoryImports } from "../src/shared/wellHistoryImport";

test("selectLatestWellHistoryImports keeps the last file for each well number", () => {
  const result = selectLatestWellHistoryImports([
    { wellNo: "坨37-29", sourceOrder: 0, sourceOriginalName: "坨37-29-old.pptx" },
    { wellNo: "坨37-31", sourceOrder: 1, sourceOriginalName: "坨37-31.pptx" },
    { wellNo: "坨37-29", sourceOrder: 2, sourceOriginalName: "坨37-29-new.pptx" },
  ]);

  assert.deepEqual(result.selected.map(item => item.sourceOriginalName), ["坨37-31.pptx", "坨37-29-new.pptx"]);
  assert.deepEqual(result.superseded.map(item => item.sourceOriginalName), ["坨37-29-old.pptx"]);
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- tests/wellHistoryImport.test.ts`

Expected: FAIL，缺少 `selectLatestWellHistoryImports`。

- [ ] **Step 3: 实现最小纯函数**

```ts
export function selectLatestWellHistoryImports<T extends { wellNo: string; sourceOrder: number }>(items: T[]) {
  const latestByWellNo = new Map<string, T>();
  const superseded: T[] = [];
  for (const item of items) {
    const previous = latestByWellNo.get(item.wellNo);
    if (previous) superseded.push(previous);
    latestByWellNo.set(item.wellNo, item);
  }
  return {
    selected: [...latestByWellNo.values()].sort((a, b) => a.sourceOrder - b.sourceOrder),
    superseded: superseded.sort((a, b) => a.sourceOrder - b.sourceOrder),
  };
}
```

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `npm test -- tests/wellHistoryImport.test.ts`

Expected: PASS。

### Task 2: 批量导入路由应用最后文件覆盖语义

**Files:**
- Modify: `server.ts:3150-3220`
- Modify: `tests/wellHistoryImport.test.ts`

- [ ] **Step 1: 将解析后的有效文件收集为平铺数组**

每项包含现有 `entry/sourceOrder/sourceOriginalName/partOrder` 和规范化后的 `wellNo`。调用 `selectLatestWellHistoryImports`，先把 `superseded` 映射为：

```ts
items.push({
  fileName: item.sourceOriginalName,
  wellNo: item.wellNo,
  status: "superseded",
  message: "已被同批次后续文件覆盖",
});
```

- [ ] **Step 2: 仅遍历 selected 执行现有 COM 导入**

删除 `parts.length !== 1` 的 `merge-not-supported` 分支；每个 selected 项继续使用现有源文件落盘、COM PNG 导出、PPTX 解析、富文本保存和失败清理逻辑。

- [ ] **Step 3: 返回覆盖计数**

```ts
const successCount = items.filter(item => item.status === "success").length;
const supersededCount = items.filter(item => item.status === "superseded").length;
const failureCount = items.length - successCount - supersededCount;
res.json({ successCount, supersededCount, failureCount, items });
```

- [ ] **Step 4: 运行导入测试与类型检查**

Run: `npm test -- tests/wellHistoryImport.test.ts && npm run lint`

Expected: PASS。

### Task 3: 将顶部功能栏迁入左侧栏

**Files:**
- Modify: `src/App.tsx:7440-7690`
- Modify: `tests/appShell.test.ts`

- [ ] **Step 1: 编写布局契约失败测试**

在 `tests/appShell.test.ts` 读取 `src/App.tsx` 后增加断言：

```ts
assert.match(source, /data-well-history-sidebar/);
assert.match(source, /data-well-history-content/);
const sidebar = source.slice(source.indexOf("data-well-history-sidebar"), source.indexOf("data-well-history-content"));
assert.match(sidebar, /handleQuery/);
assert.match(sidebar, /saveRichTextDocument/);
assert.match(sidebar, /handleRichTextPdfDownload/);
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- tests/appShell.test.ts`

Expected: FAIL，缺少侧边栏语义标记。

- [ ] **Step 3: 迁移 JSX**

给左侧容器增加 `data-well-history-sidebar`。在批量导入进度卡片前新增“当前井与查询”卡片，迁入：

- 当前井号、单位、区块、更新时间；
- 单位和区块下拉框；
- 井号输入与查询按钮；
- 保存编辑结果与下载 PDF 按钮。

控件改为左侧栏纵向宽度：下拉框和输入框使用 `w-full`，查询/保存/下载按钮使用 `w-full justify-center`。处理函数、禁用条件和图标保持不变。

给正文容器增加 `data-well-history-content`，删除正文中原 `<div className="flex flex-wrap ...">` 顶部功能栏。

- [ ] **Step 4: 更新导入完成提示**

前端响应类型增加 `supersededCount`，提示改为：

```ts
`PPT 导入完成：共 ${pptFiles.length} 个文件，成功 ${data.successCount || 0} 个，覆盖跳过 ${data.supersededCount || 0} 个，失败 ${data.failureCount || 0} 个。`
```

- [ ] **Step 5: 运行布局测试并确认 GREEN**

Run: `npm test -- tests/appShell.test.ts`

Expected: PASS。

### Task 4: 全量验证与运行检查

**Files:**
- Modify only if verification exposes a directly related defect.

- [ ] **Step 1: 运行全量测试**

Run: `npm test`

Expected: 0 failures。

- [ ] **Step 2: 运行类型检查**

Run: `npm run lint`

Expected: exit code 0。

- [ ] **Step 3: 运行生产构建**

Run: `npm run build`

Expected: exit code 0；允许现有 bundle size warning。

- [ ] **Step 4: 检查差异**

Run: `git diff --check`

Expected: 无输出。
