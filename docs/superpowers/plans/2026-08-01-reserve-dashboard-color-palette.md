# Reserve Dashboard Color Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved red, blue, purple, and dark-red semantic colors consistently to the reserve dashboard without changing its data or layout.

**Architecture:** Keep the palette local to `HomeReserveAnalysisDashboard` and extend its existing `CHART_COLORS` object with separate recovery-rate and contribution colors. Reuse those semantic constants across cards, charts, and the contribution progress bar while preserving the existing gray contribution badge and text.

**Tech Stack:** React 19, TypeScript, Recharts, Tailwind CSS, Node test runner via `tsx`

---

### Task 1: Apply and verify the reserve-dashboard semantic palette

**Files:**
- Modify: `tests/homeReserveDashboard.test.ts:128-150`
- Modify: `src/components/HomeReserveAnalysisDashboard.tsx:35-40`
- Modify: `src/components/HomeReserveAnalysisDashboard.tsx:132-137`
- Modify: `src/components/HomeReserveAnalysisDashboard.tsx:280-284`

- [ ] **Step 1: Replace the old color-presence assertions with the approved semantic color contract**

In `tests/homeReserveDashboard.test.ts`, replace the existing three-color loop inside `home reserve analysis dashboard includes accessible, consistently colored charts` with:

```ts
  for (const color of ["#1d4ed8", "#6d28d9", "#b91c1c", "#486581", "#7f1d1d"]) {
    assert.match(source, new RegExp(color));
  }
  assert.match(source, /recovery: "#486581"/);
  assert.match(source, /backgroundColor: CHART_COLORS\.contribution/);
  assert.match(source, /rounded-full bg-slate-100 px-2\.5 py-1/);
  assert.doesNotMatch(source, /bg-teal-700/);
```

The recovery assertion prevents the unspecified recovery-rate card from inheriting the new red oil color. The badge-class assertion and progress-color assertion together ensure that only the bottom contribution progress bar changes.

- [ ] **Step 2: Run the focused test and verify that the new contract fails**

Run:

```powershell
npx tsx --test tests/homeReserveDashboard.test.ts
```

Expected: FAIL in `home reserve analysis dashboard includes accessible, consistently colored charts` because the approved color constants and contribution progress color are not implemented yet.

- [ ] **Step 3: Extend the local semantic palette**

In `src/components/HomeReserveAnalysisDashboard.tsx`, replace `CHART_COLORS` with:

```ts
const CHART_COLORS = {
  producing: "#1d4ed8",
  recoverable: "#6d28d9",
  oil: "#b91c1c",
  recovery: "#486581",
  contribution: "#7f1d1d",
};
```

- [ ] **Step 4: Wire the oil and recovery metric cards to their own semantic colors**

Keep the producing and recoverable metric entries unchanged. Replace the recovery-rate and last-year-oil entries with:

```ts
    { label: "标定采收率", value: dashboard.total.recoveryRate, unit: "%", icon: Gauge, accent: CHART_COLORS.recovery },
    { label: "上年度产油", value: dashboard.total.lastYearOil, unit: "万吨/年", icon: Activity, accent: CHART_COLORS.oil },
```

The existing Recharts bars, line, and legends already consume `CHART_COLORS.producing`, `CHART_COLORS.recoverable`, and `CHART_COLORS.oil`, so they will update without structural changes.

- [ ] **Step 5: Change only the contribution progress fill to dark red**

Replace the inner progress-bar element with:

```tsx
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: CHART_COLORS.contribution,
                    width: `${Math.min(100, Math.max(0, unit.contributionRate))}%`,
                  }}
                />
```

Do not change the preceding contribution badge or label classes.

- [ ] **Step 6: Run focused and full verification**

Run:

```powershell
npx tsx --test tests/homeReserveDashboard.test.ts
npm run lint
npm test
```

Expected: the focused test passes, TypeScript reports no errors, and the full test suite passes.

- [ ] **Step 7: Review the diff for scope and commit the implementation**

Run:

```powershell
git diff --check
git diff -- src/components/HomeReserveAnalysisDashboard.tsx tests/homeReserveDashboard.test.ts
git status --short
git add -- src/components/HomeReserveAnalysisDashboard.tsx tests/homeReserveDashboard.test.ts docs/superpowers/plans/2026-08-01-reserve-dashboard-color-palette.md
git commit -m "style: update reserve dashboard palette"
```

Expected: only the semantic color constants, their intended consumers, the focused color contract, and this plan are included in the commit; unrelated pre-existing working-tree changes remain unstaged.
