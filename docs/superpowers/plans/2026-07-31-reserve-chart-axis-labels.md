# 储量组合图 X 轴标签修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将“区块储量与产油表现”组合图的六个 X 轴区块名称从倾斜显示改为水平正向显示。

**Architecture:** 保持现有 Recharts 组合图和数据流不变，只修改主组合图 `XAxis` 的文字角度、锚点与高度，并用现有源码合同测试锁定该配置。通过真实浏览器截图验证桌面和窄屏布局。

**Tech Stack:** React、TypeScript、Recharts、Node test runner、Vite、Playwright CLI。

---

### Task 1: 锁定水平标签合同并实施修正

**Files:**
- Modify: `tests/homeReserveDashboard.test.ts`
- Modify: `src/components/HomeReserveAnalysisDashboard.tsx:163-172`

- [ ] **Step 1: 写入失败测试**

在图表可访问性测试中加入针对主组合图的源码合同：

```ts
assert.match(source, /dataKey="block"[\s\S]*?angle=\{0\}[\s\S]*?textAnchor="middle"[\s\S]*?height=\{44\}/);
assert.doesNotMatch(source, /dataKey="block"[\s\S]*?angle=\{-24\}/);
```

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `npx tsx --test tests/homeReserveDashboard.test.ts`

Expected: FAIL，因为当前配置仍为 `angle={-24}`、`textAnchor="end"`、`height={68}`。

- [ ] **Step 3: 最小修改 XAxis**

将主组合图的 `XAxis` 精确改为：

```tsx
<XAxis
  dataKey="block"
  interval={0}
  angle={0}
  textAnchor="middle"
  height={44}
  tickMargin={12}
  tick={{ fill: "#64748b", fontSize: 12, fontFamily: "inherit" }}
/>
```

保持 `ComposedChart`、数据、双轴、Tooltip、图例和其他图表不变。

- [ ] **Step 4: 运行自动化验证**

Run: `npx tsx --test tests/homeReserveDashboard.test.ts && npm run lint && npm test && npm run build && git diff --check`

Expected: 全部退出码为 0。

- [ ] **Step 5: 浏览器视觉验收**

在约 1600×900 和 768×1024 视口检查首页：六个区块名称水平显示、互不重叠、最长名称完整可读；窄屏沿用图表区域横向滚动。

- [ ] **Step 6: 提交**

```bash
git add src/components/HomeReserveAnalysisDashboard.tsx tests/homeReserveDashboard.test.ts
git commit -m "fix: align reserve chart axis labels"
```
