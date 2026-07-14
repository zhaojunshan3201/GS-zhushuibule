# Reference Theme and Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every existing application page to the reference system’s welcome screen, dark sidebar, status header, and card-based content shell without changing any business behavior.

**Architecture:** Keep `AppContent`, page components, API calls, auth guards, navigation state, and data flows intact. Replace only the application shell in `src/App.tsx` and shared Tailwind component styles in `src/index.css`; the new shell receives the existing `activePage`, `visibleNavItems`, and submenu state.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vite, Lucide React, Node test runner.

---

## File structure

- Modify: `src/App.tsx` — add non-persistent welcome-screen state; replace the red horizontal navigation shell with the reference-inspired sidebar, top status bar, breadcrumb, and mobile navigation trigger.
- Modify: `src/index.css` — replace CNPC-red shell tokens and components with the reference blue/orange design tokens; provide reusable styles for cards, toolbars, tables, dialogs, responsive navigation, and the welcome overlay.
- Create: `tests/appShell.test.ts` — source-level regression test ensuring the shell exposes the welcome overlay, side navigation, responsive control, and preserves the existing `AppContent` mount.

### Task 1: Add shell regression coverage

**Files:**
- Create: `tests/appShell.test.ts`

- [ ] **Step 1: Write the failing shell contract test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("application shell retains content mounting while exposing reference layout regions", () => {
  assert.match(appSource, /showWelcome/);
  assert.match(appSource, /shell-sidebar/);
  assert.match(appSource, /shell-topbar/);
  assert.match(appSource, /<AppContent/);
  assert.match(cssSource, /--color-shell-primary: #1a5276/);
  assert.match(cssSource, /\.shell-welcome-overlay/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/appShell.test.ts`

Expected: FAIL because the new shell contracts do not yet exist.

- [ ] **Step 3: Keep this test unchanged until Tasks 2 and 3 supply the shell**

Do not add API mocks or alter existing test files: this task verifies visual-shell contracts only and must not reach server code.

### Task 2: Define the reference visual system

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace the shell token block with the reference palette**

Within `@theme`, preserve existing table color names needed by page components and add:

```css
--color-shell-primary: #1a5276;
--color-shell-primary-dark: #0e2f44;
--color-shell-primary-light: #2980b9;
--color-shell-accent: #e67e22;
--color-shell-bg: #f0f2f5;
--color-shell-panel: #ffffff;
--color-shell-border: #dce1e8;
--color-shell-text: #2c3e50;
--color-shell-muted: #7f8c8d;
```

- [ ] **Step 2: Add the reusable reference-layout selectors**

```css
.shell-app { @apply min-h-screen bg-shell-bg text-shell-text; }
.shell-sidebar { @apply fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[linear-gradient(180deg,#0e2f44_0%,#1a5276_100%)] text-white; }
.shell-topbar { @apply sticky top-0 z-40 flex h-[60px] items-center justify-between bg-white px-7 shadow-sm; }
.shell-main { @apply min-h-screen pl-60; }
.shell-content { @apply w-full px-6 py-6 lg:px-8; }
.shell-panel { @apply rounded-lg border border-shell-border bg-white shadow-sm; }
.shell-toolbar { @apply flex flex-wrap items-center gap-3 rounded-lg border border-shell-border bg-white px-4 py-3 shadow-sm; }
```

Add `.shell-sidebar-nav`, `.shell-nav-link`, `.shell-nav-link-active`, `.shell-subnav`, `.shell-welcome-overlay`, `.shell-welcome-card`, `.shell-mobile-trigger`, and an `@media (max-width: 1023px)` rule that hides the sidebar unless it has `.is-open`, removes main left padding, and displays the trigger. Do not alter `.cnpc-table` column, border, or overflow behavior.

- [ ] **Step 3: Restyle shared elements without changing semantics**

Make page headings, filters, dialogs, buttons, cards, and tables inherit the blue/orange visual hierarchy. Preserve all existing `cnpc-*` class names so feature pages keep their current data and interactions.

- [ ] **Step 4: Build the stylesheet**

Run: `npm run build`

Expected: Vite completes with `✓ built` and no unknown Tailwind utility error.

### Task 3: Replace the React application shell

**Files:**
- Modify: `src/App.tsx:8208-8410`

- [ ] **Step 1: Add presentation-only shell state next to existing `useState` calls**

```tsx
const [showWelcome, setShowWelcome] = useState(true);
const [mobileNavOpen, setMobileNavOpen] = useState(false);
```

Do not put `showWelcome` in local storage and do not alter `activePage`, `currentUser`, `pendingPage`, or the existing unsaved-PDF flow.

- [ ] **Step 2: Derive the breadcrumb label from existing navigation data**

```tsx
const pageLabel = [...NAV_ITEMS, ...ZONAL_INJECTION_SUB_ITEMS].find((item) => item.id === activePage)?.label ?? "首页";
```

- [ ] **Step 3: Replace only the outer header/nav/main markup**

Render the welcome overlay before the shell, preserve existing dialogs, and mount all current content unchanged:

```tsx
{showWelcome && (
  <div className="shell-welcome-overlay">
    <div className="shell-welcome-card">
      <p className="shell-welcome-eyebrow">高升采油厂 · 注水管理平台</p>
      <Droplet className="mx-auto h-14 w-14 text-shell-accent" />
      <h1>注水管理平台</h1>
      <p>以数据驱动决策 · 以智能提升效率</p>
      <button type="button" className="shell-primary-btn" onClick={() => setShowWelcome(false)}>进入系统</button>
    </div>
  </div>
)}
<aside className={cn("shell-sidebar", mobileNavOpen && "is-open")}>{/* existing nav map */}</aside>
<div className="shell-main">
  <header className="shell-topbar">{/* breadcrumb, status, existing auth controls */}</header>
  <main className="shell-content"><AppContent /* preserve existing props exactly */ /></main>
</div>
```

Each sidebar button must continue to call `requestPageChange(item.id === "zonal-injection" ? "zonal-indicator-summary" : item.id)`. Keep `showZonalSubNav` and render `ZONAL_INJECTION_SUB_ITEMS` inside the sidebar beneath its parent item. On mobile, every page-change button must also call `setMobileNavOpen(false)`.

- [ ] **Step 4: Move existing auth controls without changing handlers**

Reuse the current `currentUser ? logout : setShowLoginDialog(true)` branches in the top bar. Do not rename `AUTH_STORAGE_KEY`, edit the Axios interceptor, or change write guarding.

- [ ] **Step 5: Run the shell regression test**

Run: `npm test -- tests/appShell.test.ts`

Expected: PASS with one passing shell-contract test.

- [ ] **Step 6: Commit the test and implementation**

```powershell
git add tests/appShell.test.ts src/App.tsx src/index.css
git commit -m "feat: apply reference application shell"
```

### Task 4: Verify retained behavior and responsive layout

**Files:**
- Modify: `src/App.tsx` and `src/index.css` only if a failed verification identifies a shell-class or responsive-layout defect.

- [ ] **Step 1: Run automated verification**

```powershell
npm run lint
npm test
npm run build
```

Expected: all commands exit with code 0.

- [ ] **Step 2: Perform desktop acceptance checks**

Run: `npm run dev`

Verify the welcome screen and button; every visible main navigation item and all five zonal subpages; guest write guards, login, and logout; one wide-table page; one import/export page; and the well-history editor with unsaved-save protection.

- [ ] **Step 3: Perform narrow-screen acceptance checks**

At a viewport narrower than 1024px, verify the sidebar is hidden by default, the mobile trigger opens it, selecting a page closes it, and wide tables remain horizontally scrollable.

- [ ] **Step 4: Commit verification-only corrections and push**

```powershell
git add src/App.tsx src/index.css tests/appShell.test.ts
git commit -m "fix: polish responsive reference layout"
git push
```

## Self-review

- **Spec coverage:** Task 2 provides the reference colors, cards, controls, tables, welcome overlay, desktop sidebar, and responsive rules. Task 3 applies them while preserving navigation and auth/write behavior. Task 4 verifies table, modal, import/export, editor, and mobile behavior.
- **Placeholder scan:** no deferred work, ambiguous file paths, or undefined functions are included.
- **Type consistency:** `showWelcome`, `mobileNavOpen`, `pageLabel`, `requestPageChange`, `showZonalSubNav`, `visibleNavItems`, and `AppContent` are existing or explicitly defined names in `src/App.tsx`.

