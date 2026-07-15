# Five Theme Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide five persistent visual themes selectable from the existing home page without changing layouts or business behavior.

**Architecture:** Keep theme names, validation, storage parsing, and document-attribute conversion in a small pure module. `App` owns the selected-theme state and renders the home-only selector; `index.css` maps each `data-theme` value to visual-token overrides consumed by existing shell and table classes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Node test runner, Vite.

---

## File structure

- Create: `src/shared/theme.ts` — theme keys, labels, valid-key guard, safe stored-value reader, and root attribute helper.
- Create: `tests/theme.test.ts` — pure persistence and validation regression coverage.
- Modify: `src/App.tsx` — reads/saves the selected theme, applies the root attribute, and renders a home-only selector.
- Modify: `src/index.css` — theme-specific CSS custom-property overrides and shared component references to those properties.

### Task 1: Define and test theme state

**Files:**
- Create: `src/shared/theme.ts`
- Create: `tests/theme.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THEME, getStoredTheme, isThemeKey, THEME_OPTIONS } from "../src/shared/theme";

test("declares the five selectable themes", () => {
  assert.deepEqual(THEME_OPTIONS.map((theme) => theme.key), ["default", "oil-blue", "enterprise-white", "industrial-dark", "emerald-gold"]);
});

test("accepts only a declared theme key", () => {
  assert.equal(isThemeKey("industrial-dark"), true);
  assert.equal(isThemeKey("unknown"), false);
});

test("falls back to the default theme for missing or invalid storage", () => {
  assert.equal(getStoredTheme(null), DEFAULT_THEME);
  assert.equal(getStoredTheme("unknown"), DEFAULT_THEME);
  assert.equal(getStoredTheme("emerald-gold"), "emerald-gold");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test tests/theme.test.ts`

Expected: FAIL because `src/shared/theme.ts` does not exist.

- [ ] **Step 3: Implement the pure theme module**

```ts
export const THEME_STORAGE_KEY = "gszhushui_theme";
export const DEFAULT_THEME = "default" as const;

export const THEME_OPTIONS = [
  { key: "default", label: "当前默认主题" },
  { key: "oil-blue", label: "专业油田蓝" },
  { key: "enterprise-white", label: "极简企业白" },
  { key: "industrial-dark", label: "深色工业台" },
  { key: "emerald-gold", label: "墨绿鎏金" },
] as const;

export type ThemeKey = (typeof THEME_OPTIONS)[number]["key"];

export const isThemeKey = (value: string | null): value is ThemeKey =>
  THEME_OPTIONS.some((theme) => theme.key === value);

export const getStoredTheme = (value: string | null): ThemeKey =>
  isThemeKey(value) ? value : DEFAULT_THEME;
```

- [ ] **Step 4: Run the focused test**

Run: `npx tsx --test tests/theme.test.ts`

Expected: PASS with three passing tests.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/theme.ts tests/theme.test.ts
git commit -m "feat: add theme state helpers"
```

### Task 2: Apply visual themes without layout changes

**Files:**
- Modify: `src/index.css:3-230`

- [ ] **Step 1: Add theme-contract assertions to `tests/theme.test.ts`**

```ts
import { readFileSync } from "node:fs";

test("stylesheet defines all non-default theme selectors", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  for (const key of ["oil-blue", "enterprise-white", "industrial-dark", "emerald-gold"]) {
    assert.match(css, new RegExp(String.raw`data-theme="${key}"`));
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test tests/theme.test.ts`

Expected: FAIL because stylesheet selectors are absent.

- [ ] **Step 3: Add CSS custom-property overrides**

Keep existing dimensions, spacing, layout selectors, and table structure unchanged. Add these selectors near the root styles:

```css
.shell-app[data-theme="oil-blue"] { --theme-primary: #0d4165; --theme-surface: #ffffff; --theme-bg: #eef3f7; --theme-accent: #ff7a00; --theme-border: #c9d9e6; --theme-text: #16324a; --theme-table-head: #e7f1f9; }
.shell-app[data-theme="enterprise-white"] { --theme-primary: #ffffff; --theme-surface: #ffffff; --theme-bg: #fbfcfe; --theme-accent: #2f6fed; --theme-border: #e6eaf0; --theme-text: #172b4d; --theme-table-head: #f2f6ff; }
.shell-app[data-theme="industrial-dark"] { --theme-primary: #090f18; --theme-surface: #111b27; --theme-bg: #0c1420; --theme-accent: #ffc400; --theme-border: #334155; --theme-text: #e7eef8; --theme-table-head: #172538; }
.shell-app[data-theme="emerald-gold"] { --theme-primary: #045440; --theme-surface: #fffdf7; --theme-bg: #eff5ee; --theme-accent: #d6a633; --theme-border: #d9c98d; --theme-text: #104735; --theme-table-head: #e5f3e7; }
```

Refactor only existing shell and `.cnpc-table` visual declarations to consume `--theme-*` values with the current default colors as fallbacks. Preserve all layout utilities, overflow behavior, font sizes, and DOM-dependent selector names.

- [ ] **Step 4: Run style validation**

Run: `npm run build`

Expected: Vite completes successfully.

- [ ] **Step 5: Commit**

```powershell
git add src/index.css tests/theme.test.ts
git commit -m "feat: add five visual theme styles"
```

### Task 3: Add the home-page selector and persistence

**Files:**
- Modify: `src/App.tsx:1-40,8208-8460`
- Modify: `tests/appShell.test.ts`

- [ ] **Step 1: Add a failing application-contract test**

Append this to `tests/appShell.test.ts`:

```ts
test("application shell exposes a home-only persistent theme selector", () => {
  assert.match(appSource, /THEME_STORAGE_KEY/);
  assert.match(appSource, /data-theme/);
  assert.match(appSource, /主题切换/);
  assert.match(appSource, /activePage === "home"/);
});
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `npx tsx --test tests/appShell.test.ts`

Expected: FAIL because no theme imports, attribute, or selector exists.

- [ ] **Step 3: Add state, persistence, and root attribute**

Import `DEFAULT_THEME`, `getStoredTheme`, `THEME_OPTIONS`, `THEME_STORAGE_KEY`, and `ThemeKey`. Initialize from `localStorage` only in a browser-safe lazy initializer, save after a selection, and add the selected key to the existing root node:

```tsx
const [theme, setTheme] = useState<ThemeKey>(() => getStoredTheme(localStorage.getItem(THEME_STORAGE_KEY)));

useEffect(() => {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}, [theme]);

<div className="shell-app" data-theme={theme} ...>
```

- [ ] **Step 4: Render the selector only on the home page**

Place the selector in the existing top bar, gated by `activePage === "home"`, without adding a route or moving existing controls:

```tsx
{activePage === "home" && (
  <label className="theme-switcher">
    <span>主题切换</span>
    <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeKey)}>
      {THEME_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
    </select>
  </label>
)}
```

Add only the selector's visual styles in `src/index.css`; do not change top-bar layout behavior or existing controls.

- [ ] **Step 5: Run verification**

```powershell
npx tsx --test tests/theme.test.ts tests/appShell.test.ts
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add src/App.tsx src/index.css tests/appShell.test.ts
git commit -m "feat: add persistent home theme switcher"
```

## Self-review

- **Spec coverage:** Tasks 1–3 create five named choices, validate and restore stored values, apply visual-only CSS overrides, render the selector only at home, and preserve all feature behavior.
- **Placeholder scan:** no deferred requirements or ambiguous implementation steps remain.
- **Type consistency:** `ThemeKey`, `THEME_OPTIONS`, `DEFAULT_THEME`, `THEME_STORAGE_KEY`, `isThemeKey`, and `getStoredTheme` are all declared in Task 1 and used consistently afterward.

