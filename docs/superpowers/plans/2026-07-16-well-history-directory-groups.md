# 井史目录二级菜单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将井史目录改为按作业区分组、默认展开且可折叠的二级菜单。

**Architecture:** 在 `WellHistoryPage` 内用 `useMemo` 从现有 `archives` 生成作业区分组，用状态记录已折叠的作业区名称。目录渲染以分组标题和既有井号行组成；不改变接口、数据库或井号打开/删除处理。

**Tech Stack:** React 19、TypeScript、Tailwind CSS、lucide-react、node:test。

---

### Task 1: 目录分组与展开状态测试

**Files:**
- Modify: `C:/Users/31541/Desktop/7.6/Fzs/gszhushuiSQL/tests/appShell.test.ts`
- Test: `C:/Users/31541/Desktop/7.6/Fzs/gszhushuiSQL/tests/appShell.test.ts`

- [ ] **Step 1: 写入失败测试**

在 `tests/appShell.test.ts` 添加测试，要求 `WellHistoryPage` 包含按 `item.unit || "未分配作业区"` 分组的 `groupedArchives`、`collapsedUnits` 状态，以及使用 `ChevronDown` 的分组标题：

```ts
test("well history directory groups wells by operating area with expanded groups by default", () => {
  const page = findFunction("WellHistoryPage");
  assert.ok(page?.body);
  const source = page.getText(appAst);
  assert.match(source, /const groupedArchives = useMemo\(/);
  assert.match(source, /item\.unit \|\| "未分配作业区"/);
  assert.match(source, /const \[collapsedUnits, setCollapsedUnits\] = useState<Set<string>>\(\(\) => new Set\(\)\)/);
  assert.match(source, /ChevronDown/);
  assert.match(source, /!collapsedUnits\.has\(unitName\)/);
});
```

- [ ] **Step 2: 验证测试失败**

运行：`npx tsx --test tests/appShell.test.ts`

预期：新增测试失败，因为目录尚未定义分组和折叠状态。

- [ ] **Step 3: 提交失败测试**

运行：`git add tests/appShell.test.ts; git commit -m "test: cover grouped well history directory"`

### Task 2: 实现作业区二级菜单

**Files:**
- Modify: `C:/Users/31541/Desktop/7.6/Fzs/gszhushuiSQL/src/App.tsx:1-28,7290-7305,7731-7751`
- Test: `C:/Users/31541/Desktop/7.6/Fzs/gszhushuiSQL/tests/appShell.test.ts`

- [ ] **Step 1: 导入展开图标并声明状态**

在 `lucide-react` 导入中加入 `ChevronDown`，并在 `WellHistoryPage` 的状态声明中加入：

```tsx
const [collapsedUnits, setCollapsedUnits] = useState<Set<string>>(() => new Set());
```

- [ ] **Step 2: 在目录渲染前生成分组**

在返回 JSX 前加入：

```tsx
const groupedArchives = useMemo(() => {
  const groups = new Map<string, WellHistoryArchiveSummary[]>();
  for (const item of archives) {
    const unitName = item.unit || "未分配作业区";
    groups.set(unitName, [...(groups.get(unitName) || []), item]);
  }
  return [...groups.entries()];
}, [archives]);
```

- [ ] **Step 3: 用分组标题和井号子项替换平铺列表**

将 `archives.map((item) => ...)` 替换为按 `groupedArchives` 遍历的 JSX：每个标题按钮调用 `setCollapsedUnits` 切换该作业区名称；标题显示 `{unitName}（{unitArchives.length}）` 和 `ChevronDown`；只有 `!collapsedUnits.has(unitName)` 时渲染原有井号行。井号子项维持 `openWell(item.wellNo)`、`handleDeleteArchive(item)` 和 `selectedWellNo` 高亮逻辑，并添加 `ml-3` 形成二级缩进。

- [ ] **Step 4: 验证测试通过**

运行：`npx tsx --test tests/appShell.test.ts`

预期：7 个测试通过，新增分组目录测试通过。

- [ ] **Step 5: 提交实现**

运行：`git add src/App.tsx; git commit -m "feat: group well history directory by unit"`

### Task 3: 全量验证

**Files:**
- Verify: `C:/Users/31541/Desktop/7.6/Fzs/gszhushuiSQL/tests/**/*.test.ts`
- Verify: `C:/Users/31541/Desktop/7.6/Fzs/gszhushuiSQL/src/App.tsx`

- [ ] **Step 1: 运行完整测试、类型检查和生产构建**

运行：`npm test; npm run lint; npm run build`

预期：所有命令以退出码 0 完成。

- [ ] **Step 2: 浏览器确认默认展开与折叠交互**

打开 `http://127.0.0.1:5000` 的“单井井史”页面，确认各作业区初始都显示井号子项；点击一个作业区标题后，仅该组井号子项隐藏；再次点击恢复显示；点击井号和删除按钮仍执行原有动作。

- [ ] **Step 3: 提交验证后的最终状态**

运行：`git status --short`

预期：除用户既有的未跟踪文件外，无本功能产生的未提交改动。
