# Admin Custom Reserve Dashboard Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let existing system-settings administrators persist and restore five custom reserve-dashboard colors that all users receive when they refresh or re-enter the home page.

**Architecture:** Store the five-color palette atomically as JSON under the existing `homeReserveChartColors` system-config key. A new pure shared module owns defaults, validation, parsing, and serialization; `SystemSettingsPage` edits and saves it, `HomePage` loads it independently of reserve data, and `HomeReserveAnalysisDashboard` only consumes the resolved palette through props.

**Tech Stack:** React 19, TypeScript, Axios, Recharts, Tailwind CSS, Node test runner through `tsx`

---

### Task 1: Add the shared color configuration model

**Files:**
- Create: `src/shared/homeReserveChartColors.ts`
- Create: `tests/homeReserveChartColors.test.ts`

- [ ] **Step 1: Write failing tests for defaults, arbitrary colors, partial fallback, malformed JSON, and serialization**

Create `tests/homeReserveChartColors.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_HOME_RESERVE_CHART_COLORS,
  HOME_RESERVE_CHART_COLORS_CONFIG_KEY,
  parseHomeReserveChartColors,
  serializeHomeReserveChartColors,
} from "../src/shared/homeReserveChartColors";

test("declares the approved reserve dashboard color defaults", () => {
  assert.equal(HOME_RESERVE_CHART_COLORS_CONFIG_KEY, "homeReserveChartColors");
  assert.deepEqual(DEFAULT_HOME_RESERVE_CHART_COLORS, {
    oil: "#EF4444",
    producing: "#2563EB",
    recoverable: "#C026D3",
    recovery: "#486581",
    contribution: "#7F1D1D",
  });
});

test("accepts arbitrary valid colors including yellow and green", () => {
  assert.deepEqual(parseHomeReserveChartColors(JSON.stringify({
    oil: "#FFFF00",
    producing: "#00AA00",
    recoverable: "#12ABCD",
    recovery: "#000000",
    contribution: "#ffffff",
  })), {
    oil: "#FFFF00",
    producing: "#00AA00",
    recoverable: "#12ABCD",
    recovery: "#000000",
    contribution: "#ffffff",
  });
});

test("falls back only invalid or missing color fields", () => {
  assert.deepEqual(parseHomeReserveChartColors(JSON.stringify({
    oil: "red",
    producing: "#00AA00",
    recoverable: "#12345",
  })), {
    oil: "#EF4444",
    producing: "#00AA00",
    recoverable: "#C026D3",
    recovery: "#486581",
    contribution: "#7F1D1D",
  });
});

test("falls back to all defaults for missing or malformed JSON", () => {
  assert.deepEqual(parseHomeReserveChartColors(undefined), DEFAULT_HOME_RESERVE_CHART_COLORS);
  assert.deepEqual(parseHomeReserveChartColors("not-json"), DEFAULT_HOME_RESERVE_CHART_COLORS);
  assert.deepEqual(parseHomeReserveChartColors("[]"), DEFAULT_HOME_RESERVE_CHART_COLORS);
});

test("serializes the complete palette as one atomic config value", () => {
  const colors = {
    oil: "#FFFF00",
    producing: "#00AA00",
    recoverable: "#C026D3",
    recovery: "#486581",
    contribution: "#7F1D1D",
  };
  assert.deepEqual(JSON.parse(serializeHomeReserveChartColors(colors)), colors);
});
```

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```powershell
npx.cmd tsx --test tests/homeReserveChartColors.test.ts
```

Expected: FAIL because `src/shared/homeReserveChartColors.ts` does not exist.

- [ ] **Step 3: Implement the pure shared model**

Create `src/shared/homeReserveChartColors.ts`:

```ts
export type HomeReserveChartColors = {
  oil: string;
  producing: string;
  recoverable: string;
  recovery: string;
  contribution: string;
};

export const HOME_RESERVE_CHART_COLORS_CONFIG_KEY = "homeReserveChartColors";

export const DEFAULT_HOME_RESERVE_CHART_COLORS: HomeReserveChartColors = {
  oil: "#EF4444",
  producing: "#2563EB",
  recoverable: "#C026D3",
  recovery: "#486581",
  contribution: "#7F1D1D",
};

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

function normalizeHomeReserveChartColors(value: unknown): HomeReserveChartColors {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const read = (key: keyof HomeReserveChartColors) => {
    const candidate = source[key];
    return isHexColor(candidate) ? candidate : DEFAULT_HOME_RESERVE_CHART_COLORS[key];
  };

  return {
    oil: read("oil"),
    producing: read("producing"),
    recoverable: read("recoverable"),
    recovery: read("recovery"),
    contribution: read("contribution"),
  };
}

export function parseHomeReserveChartColors(value: string | null | undefined): HomeReserveChartColors {
  if (!value) return { ...DEFAULT_HOME_RESERVE_CHART_COLORS };
  try {
    return normalizeHomeReserveChartColors(JSON.parse(value));
  } catch {
    return { ...DEFAULT_HOME_RESERVE_CHART_COLORS };
  }
}

export function serializeHomeReserveChartColors(colors: HomeReserveChartColors): string {
  return JSON.stringify(colors);
}
```

- [ ] **Step 4: Run the shared-model tests and verify GREEN**

Run:

```powershell
npx.cmd tsx --test tests/homeReserveChartColors.test.ts
```

Expected: 5 tests pass, 0 fail.

- [ ] **Step 5: Commit the shared model**

```powershell
git add -- src/shared/homeReserveChartColors.ts tests/homeReserveChartColors.test.ts
git commit -m "feat: add reserve chart color config model"
```

---

### Task 2: Make the dashboard consume a palette and load it on home entry

**Files:**
- Modify: `src/components/HomeReserveAnalysisDashboard.tsx:1-42,132-200,238,288`
- Modify: `src/App.tsx:40-85,557-588`
- Modify: `tests/homeReserveDashboard.test.ts:128-151,164-176`
- Modify: `tests/appShell.test.ts:1-130`

- [ ] **Step 1: Write failing dashboard-prop and home-loading tests**

In `tests/homeReserveDashboard.test.ts`, import the type and replace the fixed local-color assertions with prop-consumer assertions:

```ts
import type { HomeReserveChartColors } from "../src/shared/homeReserveChartColors";

// Inside "home reserve analysis dashboard includes accessible, consistently colored charts":
assert.doesNotMatch(source, /const CHART_COLORS =/);
assert.match(source, /colors = DEFAULT_HOME_RESERVE_CHART_COLORS/);
assert.match(source, /accent: colors\.producing/);
assert.match(source, /accent: colors\.recoverable/);
assert.match(source, /accent: colors\.recovery/);
assert.match(source, /accent: colors\.oil/);
assert.match(source, /backgroundColor: colors\.contribution/);
assert.match(source, /fill=\{colors\.producing\}/);
assert.match(source, /fill=\{colors\.recoverable\}/);
assert.match(source, /stroke=\{colors\.oil\}/);
```

Add this behavioral rendering test:

```ts
test("home reserve analysis dashboard renders every supplied custom color", () => {
  const rows = buildHomeReserveOverviewRows(buildHomeReserveOverviewSeedRows());
  const colors: HomeReserveChartColors = {
    oil: "#ff1111",
    producing: "#00aa00",
    recoverable: "#ffff00",
    recovery: "#123456",
    contribution: "#654321",
  };
  const markup = renderToStaticMarkup(createElement(HomeReserveAnalysisDashboard, { rows, colors }));

  for (const color of Object.values(colors)) assert.match(markup, new RegExp(color, "i"));
});
```

In `tests/appShell.test.ts`, add:

```ts
test("home page loads reserve colors independently and passes them to the dashboard", () => {
  const homePage = findFunction("HomePage");
  assert.ok(homePage?.body);
  const source = homePage.getText(appAst);

  assert.match(source, /useState\(\{ \.\.\.DEFAULT_HOME_RESERVE_CHART_COLORS \}\)/);
  assert.match(source, /axios\.get<Record<string, string>>\("\/api\/config"\)/);
  assert.match(source, /parseHomeReserveChartColors\(data\[HOME_RESERVE_CHART_COLORS_CONFIG_KEY\]\)/);
  assert.match(source, /setChartColors\(\{ \.\.\.DEFAULT_HOME_RESERVE_CHART_COLORS \}\)/);
  assert.match(source, /<HomeReserveAnalysisDashboard rows=\{rows\} loading=\{loading\} colors=\{chartColors\}/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npx.cmd tsx --test tests/homeReserveDashboard.test.ts tests/appShell.test.ts
```

Expected: FAIL because the component has no `colors` prop and `HomePage` does not load global colors.

- [ ] **Step 3: Convert the dashboard from a local constant to a defaulted prop**

In `src/components/HomeReserveAnalysisDashboard.tsx`, add:

```ts
import {
  DEFAULT_HOME_RESERVE_CHART_COLORS,
  type HomeReserveChartColors,
} from "../shared/homeReserveChartColors";
```

Replace its props and function signature with:

```ts
type HomeReserveAnalysisDashboardProps = {
  rows: HomeReserveOverviewRow[];
  loading?: boolean;
  colors?: HomeReserveChartColors;
};

export function HomeReserveAnalysisDashboard({
  rows,
  loading = false,
  colors = DEFAULT_HOME_RESERVE_CHART_COLORS,
}: HomeReserveAnalysisDashboardProps) {
```

Delete the local `CHART_COLORS` object. Replace every `CHART_COLORS.producing`, `.recoverable`, `.oil`, `.recovery`, and `.contribution` reference with the corresponding `colors` property. Do not change chart structure, labels, layout, data derivation, or other styles.

- [ ] **Step 4: Load config independently when HomePage mounts**

In `src/App.tsx`, add:

```ts
import {
  DEFAULT_HOME_RESERVE_CHART_COLORS,
  HOME_RESERVE_CHART_COLORS_CONFIG_KEY,
  parseHomeReserveChartColors,
} from "./shared/homeReserveChartColors";
```

Add state inside `HomePage`:

```ts
const [chartColors, setChartColors] = useState({ ...DEFAULT_HOME_RESERVE_CHART_COLORS });
```

At the start of the existing `useEffect`, before the reserve request, start an independent config request:

```ts
void axios.get<Record<string, string>>("/api/config")
  .then(({ data }) => {
    if (active) setChartColors(parseHomeReserveChartColors(data[HOME_RESERVE_CHART_COLORS_CONFIG_KEY]));
  })
  .catch(() => {
    if (active) setChartColors({ ...DEFAULT_HOME_RESERVE_CHART_COLORS });
  });
```

Keep the existing reserve request and its loading/error behavior separate so config failure cannot fail or clear reserve data. Pass the resolved palette:

```tsx
<HomeReserveAnalysisDashboard rows={rows} loading={loading} colors={chartColors} />
```

- [ ] **Step 5: Run focused tests, lint, and verify GREEN**

```powershell
npx.cmd tsx --test tests/homeReserveChartColors.test.ts tests/homeReserveDashboard.test.ts tests/appShell.test.ts
npm.cmd run lint
```

Expected: all focused tests pass and TypeScript reports no errors.

- [ ] **Step 6: Commit dashboard consumption and home loading**

```powershell
git add -- src/components/HomeReserveAnalysisDashboard.tsx src/App.tsx tests/homeReserveDashboard.test.ts tests/appShell.test.ts
git commit -m "feat: load custom reserve chart colors"
```

---

### Task 3: Add administrator color pickers, restore, and atomic save

**Files:**
- Modify: `src/App.tsx:887-1022,1118-1151`
- Modify: `tests/appShell.test.ts:82-130`

- [ ] **Step 1: Write failing settings-page contract tests**

Add to `tests/appShell.test.ts`:

```ts
test("system settings edits, restores, and atomically saves reserve chart colors", () => {
  const settingsPage = findFunction("SystemSettingsPage");
  assert.ok(settingsPage?.body);
  const source = settingsPage.getText(appAst);

  for (const key of ["oil", "producing", "recoverable", "recovery", "contribution"]) {
    assert.match(appSource, new RegExp(`key: "${key}"`));
  }
  assert.match(source, /type="color"/);
  assert.match(source, /setReserveChartColors\(\{ \.\.\.DEFAULT_HOME_RESERVE_CHART_COLORS \}\)/);
  assert.match(source, /serializeHomeReserveChartColors\(reserveChartColors\)/);
  assert.match(source, /key: HOME_RESERVE_CHART_COLORS_CONFIG_KEY/);
  assert.match(source, /value: serializeHomeReserveChartColors\(reserveChartColors\)/);
  assert.match(source, /首页储量看板颜色/);
  assert.match(source, /恢复默认色/);
  assert.match(source, /保存颜色/);
  assert.doesNotMatch(source, /window\.dispatchEvent\([^)]*reserve-chart-colors/);
});
```

- [ ] **Step 2: Run the settings test and verify RED**

```powershell
npx.cmd tsx --test tests/appShell.test.ts
```

Expected: FAIL because the settings page has no palette state, color inputs, restore action, or atomic save.

- [ ] **Step 3: Add settings labels and the five-field UI definition**

Add these `SETTINGS_TEXT` members:

```ts
chartColorsTitle: "首页储量看板颜色",
chartColorsSaved: "首页储量看板颜色已保存",
chartColorsSaveFailed: "首页储量看板颜色保存失败",
restoreChartColors: "恢复默认色",
saveChartColors: "保存颜色",
```

Add this constant after `SYSTEM_CONFIG_ITEMS`:

```ts
const HOME_RESERVE_CHART_COLOR_ITEMS = [
  { key: "oil", label: "上年度产油" },
  { key: "producing", label: "动用储量" },
  { key: "recoverable", label: "可采储量" },
  { key: "recovery", label: "标定采收率" },
  { key: "contribution", label: "总体贡献" },
] as const;
```

Extend the existing shared-module import with `serializeHomeReserveChartColors` and `type HomeReserveChartColors`.

- [ ] **Step 4: Add palette state, settings loading, restore, and save handlers**

Inside `SystemSettingsPage`, add:

```ts
const [reserveChartColors, setReserveChartColors] = useState<HomeReserveChartColors>(() => ({
  ...DEFAULT_HOME_RESERVE_CHART_COLORS,
}));
```

Immediately after `setConfig(configResponse.data || {});` in `loadSettings`, add:

```ts
setReserveChartColors(parseHomeReserveChartColors(
  (configResponse.data || {})[HOME_RESERVE_CHART_COLORS_CONFIG_KEY],
));
```

Add these handlers before `saveResponsibility`:

```ts
const restoreReserveChartColors = () => {
  setReserveChartColors({ ...DEFAULT_HOME_RESERVE_CHART_COLORS });
};

const saveReserveChartColors = async () => {
  setError("");
  try {
    await axios.post("/api/config", {
      key: HOME_RESERVE_CHART_COLORS_CONFIG_KEY,
      value: serializeHomeReserveChartColors(reserveChartColors),
    });
    setMessage(SETTINGS_TEXT.chartColorsSaved);
  } catch {
    setError(SETTINGS_TEXT.chartColorsSaveFailed);
  }
};
```

Do not dispatch a browser event or change `reserveChartColors` in the failure branch. This preserves the confirmed refresh/re-entry behavior and retains the administrator's selection after a failed save.

- [ ] **Step 5: Render only visual color inputs plus explicit restore and save buttons**

Insert this section after the existing top settings grid and before the reserve-record maintenance section:

```tsx
<section className="border border-[#8fb7df] bg-white shadow-sm" aria-labelledby="reserve-chart-colors-title">
  <h2 id="reserve-chart-colors-title" className="border-b border-[#9fc4e8] bg-[#eaf4ff] px-4 py-2 text-center text-base font-bold text-[#cc0000]">
    {SETTINGS_TEXT.chartColorsTitle}
  </h2>
  <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
    {HOME_RESERVE_CHART_COLOR_ITEMS.map((item) => (
      <label key={item.key} className="flex items-center justify-between gap-3 border border-[#d6e8f8] bg-[#f7fbff] px-3 py-2 text-xs font-bold text-slate-700">
        <span>{item.label}</span>
        <input
          type="color"
          aria-label={item.label}
          value={reserveChartColors[item.key]}
          onChange={(event) => setReserveChartColors((current) => ({
            ...current,
            [item.key]: event.target.value,
          }))}
          className="h-9 w-12 cursor-pointer border border-[#9fc4e8] bg-white p-1"
        />
      </label>
    ))}
  </div>
  <div className="flex flex-wrap gap-3 border-t border-[#d6e8f8] bg-[#f7fbff] px-4 py-3">
    <button type="button" onClick={restoreReserveChartColors} className="inline-flex h-8 items-center rounded border border-[#8fb7df] bg-white px-4 text-xs font-bold text-[#1a5276]">
      {SETTINGS_TEXT.restoreChartColors}
    </button>
    <button type="button" onClick={() => void saveReserveChartColors()} className="inline-flex h-8 items-center gap-1 rounded border border-[#2f80ed] bg-[#2f80ed] px-4 text-xs font-bold text-white">
      <Save className="h-3.5 w-3.5" />{SETTINGS_TEXT.saveChartColors}
    </button>
  </div>
</section>
```

Do not add a text input for hex values. Native `type="color"` inputs accept full-spectrum custom colors, including yellow and green.

- [ ] **Step 6: Run settings, dashboard, model tests and lint**

```powershell
npx.cmd tsx --test tests/homeReserveChartColors.test.ts tests/homeReserveDashboard.test.ts tests/appShell.test.ts
npm.cmd run lint
```

Expected: focused tests pass and TypeScript reports no errors.

- [ ] **Step 7: Commit the administrator settings UI**

```powershell
git add -- src/App.tsx tests/appShell.test.ts
git commit -m "feat: configure reserve chart colors"
```

---

### Task 4: Verify the complete feature and document the delivered behavior

**Files:**
- Modify: `README.md:316-335`

- [ ] **Step 1: Document the administrator workflow**

Add this paragraph under README's system-settings section:

```markdown
“系统设置 → 首页储量看板颜色”提供上年度产油、动用储量、可采储量、标定采收率和总体贡献五个可视化取色器。管理员可以选择包括黄色、绿色在内的任意颜色；“恢复默认色”只重置当前表单，点击“保存颜色”后才写入全局配置。新颜色在用户刷新或重新进入首页时生效。
```

- [ ] **Step 2: Run the complete verification suite**

```powershell
npx.cmd tsx --test tests/homeReserveChartColors.test.ts tests/homeReserveDashboard.test.ts tests/appShell.test.ts
npm.cmd run lint
npm.cmd test
git diff --check
```

Expected: focused tests pass, TypeScript reports no errors, the full suite has 0 failures, and `git diff --check` exits 0.

- [ ] **Step 3: Review scope and commit documentation**

```powershell
git status --short
git diff -- README.md
git add -- README.md docs/superpowers/plans/2026-08-01-admin-custom-reserve-dashboard-colors.md
git commit -m "docs: explain custom reserve chart colors"
```

Expected: the feature branch contains only the shared model, focused tests, dashboard/config wiring, administrator settings UI, README entry, and this implementation plan. Pre-existing unrelated working-tree changes are not staged.
