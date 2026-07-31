# 首页储量分析看板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页现有储量明细表上方增加 B 分析看板，用同一份接口数据准确展示总体指标、区块多指标、贡献排名和采一/采二对比。

**Architecture:** 将纯数据派生函数放入现有 `homeReserveOverview` 共享模块并进行单元测试；新增一个只负责可视化的 React 组件；`HomePage` 保持单次请求，并把返回行同时传给看板和原表。这样不改后端、不重复请求，也不触碰原表业务逻辑。

**Tech Stack:** React 19、TypeScript、Recharts 3、Tailwind CSS、Node test runner (`tsx --test`)、Vite。

---

## 文件结构

- 修改 `src/shared/homeReserveOverview.ts`：增加看板所需的区块、单位和合计派生模型。
- 修改 `tests/homeReserveOverview.test.ts`：覆盖过滤、排序、占比、单位小计和合计回退。
- 新建 `src/components/HomeReserveAnalysisDashboard.tsx`：指标卡、组合图、贡献排名、单位对比及空状态。
- 修改 `src/App.tsx`：把看板插入原表上方，保留现有请求、错误状态和表格结构。

### Task 1: 定义并验证看板数据模型

**Files:**
- Modify: `src/shared/homeReserveOverview.ts`
- Test: `tests/homeReserveOverview.test.ts`

- [ ] **Step 1: 写入失败测试**

在 `tests/homeReserveOverview.test.ts` 增加：

```ts
import { buildHomeReserveDashboardData } from "../src/shared/homeReserveOverview";

test("home reserve dashboard excludes totals and ranks blocks by producing reserve", () => {
  const dashboard = buildHomeReserveDashboardData(
    buildHomeReserveOverviewRows(buildHomeReserveOverviewSeedRows()),
  );

  assert.equal(dashboard.blocks.length, 6);
  assert.deepEqual(
    dashboard.ranking.map((row) => row.block),
    ["牛心坨油层", "雷11", "牛心坨潜山", "雷04", "雷72", "坨33"],
  );
  assert.equal(dashboard.total.producingReserve, 794.5);
  assert.equal(dashboard.total.recoverableReserve, 184.6);
  assert.equal(dashboard.total.recoveryRate, 23.23);
  assert.equal(dashboard.total.lastYearOil, 25.55);
  assert.deepEqual(dashboard.units.map((row) => row.unit), ["采一", "采二"]);
});

test("home reserve dashboard calculates contribution percentages from the total", () => {
  const dashboard = buildHomeReserveDashboardData(
    buildHomeReserveOverviewRows(buildHomeReserveOverviewSeedRows()),
  );

  assert.equal(dashboard.ranking[0].contributionRate, 27.92);
  assert.equal(dashboard.units[0].contributionRate, 44.72);
  assert.equal(dashboard.units[1].contributionRate, 55.28);
});
```

- [ ] **Step 2: 运行测试并确认因函数不存在而失败**

Run: `npm test -- tests/homeReserveOverview.test.ts`

Expected: FAIL，错误指向 `buildHomeReserveDashboardData` 未导出或不是函数。

- [ ] **Step 3: 实现最小纯函数**

在 `src/shared/homeReserveOverview.ts` 增加公开模型和函数：

```ts
export type HomeReserveDashboardRow = HomeReserveOverviewRow & {
  contributionRate: number;
};

export type HomeReserveDashboardData = {
  blocks: HomeReserveOverviewRow[];
  ranking: HomeReserveDashboardRow[];
  units: HomeReserveDashboardRow[];
  total: HomeReserveOverviewRow;
};

export function buildHomeReserveDashboardData(rows: HomeReserveOverviewRow[]): HomeReserveDashboardData {
  const blocks = rows.filter((row) => row.rowType === "block");
  const fallbackTotal = sumRows("合计", "", blocks);
  const total = rows.find((row) => row.rowType === "total") ?? fallbackTotal;
  const units = (["采一", "采二"] as const).map((unit) => {
    const unitRows = blocks.filter((row) => row.unit === unit);
    const subtotal = rows.find((row) => row.rowType === "subtotal" && row.unit === unit)
      ?? sumRows(unit, "小计", unitRows);
    return {
      ...subtotal,
      contributionRate: total.producingReserve > 0
        ? round2((subtotal.producingReserve / total.producingReserve) * 100)
        : 0,
    };
  });
  const ranking = [...blocks]
    .sort((a, b) => b.producingReserve - a.producingReserve)
    .map((row) => ({
      ...row,
      contributionRate: total.producingReserve > 0
        ? round2((row.producingReserve / total.producingReserve) * 100)
        : 0,
    }));
  return { blocks, ranking, units, total };
}
```

- [ ] **Step 4: 运行定向测试确认通过**

Run: `npm test -- tests/homeReserveOverview.test.ts`

Expected: 该文件全部测试 PASS。

### Task 2: 创建分析看板组件

**Files:**
- Create: `src/components/HomeReserveAnalysisDashboard.tsx`
- Modify: `src/shared/homeReserveOverview.ts`
- Test: `tests/homeReserveOverview.test.ts`

- [ ] **Step 1: 增加零值回退测试并确认失败**

```ts
test("home reserve dashboard keeps zero-value data finite", () => {
  const dashboard = buildHomeReserveDashboardData([]);
  assert.equal(dashboard.total.producingReserve, 0);
  assert.equal(dashboard.total.recoveryRate, 0);
  assert.deepEqual(dashboard.ranking, []);
  assert.ok(dashboard.units.every((row) => Number.isFinite(row.contributionRate)));
});
```

Run: `npm test -- tests/homeReserveOverview.test.ts`

Expected: FAIL，空输入目前无法构造完整合计或单位数据。

- [ ] **Step 2: 让纯函数对空输入返回稳定零值模型**

使用 `sumRows("合计", "", [])` 和每单位 `sumRows(unit, "小计", [])` 作为回退，所有占比在分母为 0 时返回 0。

- [ ] **Step 3: 运行定向测试确认通过**

Run: `npm test -- tests/homeReserveOverview.test.ts`

Expected: 全部测试 PASS。

- [ ] **Step 4: 实现展示组件**

新建 `src/components/HomeReserveAnalysisDashboard.tsx`，使用以下完整组件边界和图表结构：

```tsx
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildHomeReserveDashboardData,
  type HomeReserveOverviewRow,
} from "../shared/homeReserveOverview";

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");

export function HomeReserveAnalysisDashboard({ rows }: { rows: HomeReserveOverviewRow[] }) {
  const dashboard = useMemo(() => buildHomeReserveDashboardData(rows), [rows]);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="reserve-dashboard-title" className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-teal-700">RESERVE ANALYTICS</p>
          <h1 id="reserve-dashboard-title" className="text-2xl font-bold text-slate-900">储量分析看板</h1>
        </div>
        <p>区块储量、采收能力与年度产油综合分析</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["动用储量", dashboard.total.producingReserve, "万吨"],
          ["可采储量", dashboard.total.recoverableReserve, "万吨"],
          ["标定采收率", dashboard.total.recoveryRate, "%"],
          ["上年度产油", dashboard.total.lastYearOil, "万吨"],
        ].map(([label, value, unit]) => (
          <article key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(Number(value))}<small>{unit}</small></p>
          </article>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <article className="h-[360px] rounded-xl border border-slate-200 bg-white p-4" aria-label="区块储量与年度产油组合图">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dashboard.blocks}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="block" />
              <YAxis yAxisId="reserve" unit=" 万吨" />
              <YAxis yAxisId="oil" orientation="right" unit=" 万吨/年" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="reserve" dataKey="producingReserve" name="动用储量" fill="#0f766e" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="reserve" dataKey="recoverableReserve" name="可采储量" fill="#d99545" radius={[4, 4, 0, 0]} />
              <Line yAxisId="oil" dataKey="lastYearOil" name="上年度产油" stroke="#486581" strokeWidth={3} />
            </ComposedChart>
          </ResponsiveContainer>
        </article>
        <article className="h-[360px] rounded-xl border border-slate-200 bg-white p-4" aria-label="区块动用储量贡献排名">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashboard.ranking} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" unit=" 万吨" />
              <YAxis type="category" dataKey="block" width={86} />
              <Tooltip />
              <Bar dataKey="producingReserve" name="动用储量" fill="#0f766e" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {dashboard.units.map((unit) => (
          <article key={unit.unit} className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-bold text-slate-900">{unit.unit}</h2>
            <dl className="mt-3 grid grid-cols-4 gap-3 text-sm">
              <div><dt>动用储量</dt><dd>{formatNumber(unit.producingReserve)}</dd></div>
              <div><dt>可采储量</dt><dd>{formatNumber(unit.recoverableReserve)}</dd></div>
              <div><dt>采收率</dt><dd>{formatNumber(unit.recoveryRate)}%</dd></div>
              <div><dt>总体贡献</dt><dd>{formatNumber(unit.contributionRate)}%</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
```

实现约束：

- 指标卡依次显示 `dashboard.total` 的动用储量、可采储量、采收率、上年度产油。
- `ComposedChart` 数据固定取 `dashboard.blocks`；储量轴单位为“万吨”，产油轴单位为“万吨/年”。
- 排名使用 `dashboard.ranking`，按动用储量降序并在 Tooltip 中显示贡献率。
- 颜色固定为：动用 `#0f766e`、可采 `#d99545`、产油 `#486581`。
- Tooltip 数值格式与表格一致，`aria-label` 为图表补充清晰语义。

### Task 3: 将看板放在原表上方

**Files:**
- Modify: `src/App.tsx:1-60`
- Modify: `src/App.tsx:535-620`

- [ ] **Step 1: 导入组件**

```tsx
import { HomeReserveAnalysisDashboard } from "./components/HomeReserveAnalysisDashboard";
```

- [ ] **Step 2: 仅调整 HomePage 的呈现结构**

保持 `axios.get("/api/home-reserve-overview")`、错误处理、`formatValue` 和现有 `<table>` 内部完全不变。把 `return` 后原本的根节点：

```tsx
<div className="home-reserve-overview border border-[#8ebdff] bg-white">
```

替换为两层结构：

```tsx
<div className="space-y-5">
  <HomeReserveAnalysisDashboard rows={rows} />
  <section className="home-reserve-overview border border-[#8ebdff] bg-white" aria-labelledby="reserve-table-title">
```

把原来的标题元素替换为：

```tsx
<h2 id="reserve-table-title" className="border-b border-[#8ebdff] bg-[#f8fbff] py-1 text-center text-[22px] font-bold leading-tight text-[#d40000]">
  储量概览列表
</h2>
```

在原表容器的结束标签后按顺序关闭 `section` 和外层布局容器：

```tsx
  </section>
</div>
```

- [ ] **Step 3: 运行类型检查与定向测试**

Run: `npm run lint && npm test -- tests/homeReserveOverview.test.ts`

Expected: TypeScript exit 0；储量测试全部 PASS。

### Task 4: 全量验证与视觉验收

**Files:**
- Verify: `src/components/HomeReserveAnalysisDashboard.tsx`
- Verify: `src/App.tsx`
- Verify: `tests/homeReserveOverview.test.ts`

- [ ] **Step 1: 运行完整自动化验证**

Run: `npm test && npm run lint && npm run build`

Expected: 所有测试通过；TypeScript 无错误；Vite 构建 exit 0。

- [ ] **Step 2: 启动应用并检查桌面视图**

Run: `npm run dev`

在浏览器打开首页，使用约 1600×900 视口截图，确认：四张指标卡、组合图、排名、单位对比均在完整明细表上方，图表 Tooltip 可用，数值与表格一致。

- [ ] **Step 3: 检查窄屏视图**

使用约 768×1024 视口截图，确认看板变为单列、文字不重叠、图表不裁切，明细表可横向滚动。

- [ ] **Step 4: 审阅最终差异**

Run: `git diff --check && git diff -- src/shared/homeReserveOverview.ts tests/homeReserveOverview.test.ts src/components/HomeReserveAnalysisDashboard.tsx src/App.tsx`

Expected: 无空白错误；所有改动都能对应设计规格，不包含无关重构。
