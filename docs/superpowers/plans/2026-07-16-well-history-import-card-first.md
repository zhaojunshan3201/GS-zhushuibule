# 单井井史批量导入卡片置顶 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单井井史左侧栏的批量导入进度卡片移动到最顶部。

**Architecture:** 仅交换 `WellHistoryPage` 左侧栏两个既有 JSX 卡片的渲染顺序，并用源码契约测试锁定顺序。不改变组件状态、事件处理或样式。

**Tech Stack:** React、TypeScript、Node test runner。

---

### Task 1: 锁定并调整侧栏卡片顺序

**Files:**
- Modify: `tests/appShell.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: 编写失败测试**

在现有井史侧栏契约测试中取得 `data-well-history-sidebar` 到 `data-well-history-content` 的源码，断言批量导入按钮文案对应源码位置早于 `handleQuery`：

```ts
assert.ok(
  sidebarSource.indexOf("fileInputRef.current?.click()") < sidebarSource.indexOf("handleQuery"),
  "batch import card should render before the well query card",
);
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- tests/appShell.test.ts`

Expected: FAIL，当前查询卡片先于批量导入卡片。

- [ ] **Step 3: 调整 JSX 顺序**

在 `src/App.tsx` 的 `data-well-history-sidebar` 容器中，将包含导入状态、上传按钮、说明和进度条的整个卡片移动到当前井与查询卡片之前。保留卡片内部 JSX 和 className 不变。

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `npm test -- tests/appShell.test.ts`

Expected: PASS。

- [ ] **Step 5: 全量验证**

Run: `npm test && npm run lint && npm run build && git diff --check`

Expected: 测试、类型检查和构建通过；允许现有 bundle size warning；diff check 无输出。
