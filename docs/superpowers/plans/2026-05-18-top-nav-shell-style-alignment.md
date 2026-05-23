# Top Navigation Shell Style Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current sidebar-first shell with a top navigation shell and align the global visual language, login, welcome page, and shared content containers with the reference project.

**Architecture:** Keep the existing data flow, page switching, auth checks, and server APIs intact while reshaping the frontend shell in `src/App.tsx` and centralizing the visual system in `src/index.css`. Use targeted edits to the current large-file React app instead of a large refactor so the UI changes land with minimal product risk.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Axios, Lucide React

---

## File Structure

- Modify: `src/App.tsx`
  - Replace the outer shell from `Sidebar + Header + main` to `TopNav + main + footer`
  - Add or adapt the top navigation component markup inside the current file
  - Re-skin login, welcome, shell containers, and shared layout wrappers
- Modify: `src/index.css`
  - Align theme tokens and reusable utility/component classes with the reference visual system
  - Add shared classes for shell panels, filters, tables, nav, buttons, and page sections
- Modify: `src/constants.ts`
  - Normalize nav labels/order to match the top navigation presentation

## Task 1: Align Theme Tokens And Shared CSS

**Files:**
- Modify: `src/index.css`
- Test: `npm run lint`

- [ ] **Step 1: Replace the base theme tokens with the reference shell palette**

Update `src/index.css` theme tokens to align the visual system with the reference project.

```css
@theme {
  --color-cnpc-red: #a31b1b;
  --color-cnpc-red-dark: #7f1515;
  --color-cnpc-yellow: #ffcc00;
  --color-cnpc-blue: #0056a3;
  --color-shell-bg: #f8fafc;
  --color-shell-panel: #ffffff;
  --color-shell-border: #d8e2ec;
  --color-shell-muted: #6b7280;
  --color-table-header-bg: #e6f0f9;
  --color-table-header-text: #1a2b3c;
  --color-table-border: #acc6de;
  --color-link-blue: #0000ee;
  --color-action-red: #ff0000;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}
```

- [ ] **Step 2: Add base page rules for the new shell**

Add shared base rules for the full-page background and typography.

```css
@layer base {
  html, body, #root {
    min-height: 100%;
  }

  body {
    @apply bg-shell-bg text-gray-900;
  }
}
```

- [ ] **Step 3: Add reusable shell classes for nav, panels, toolbars, and content width**

Add reusable classes instead of repeating long utility strings throughout `src/App.tsx`.

```css
@layer components {
  .shell-app {
    @apply min-h-screen bg-shell-bg text-gray-900;
  }

  .shell-topbar {
    @apply sticky top-0 z-40 border-b border-shell-border bg-white/95 backdrop-blur;
  }

  .shell-topbar-inner {
    @apply mx-auto flex max-w-[1700px] items-center gap-4 px-4 py-3 lg:px-6;
  }

  .shell-content {
    @apply mx-auto w-full max-w-[1700px] px-4 py-4 lg:px-6 lg:py-6;
  }

  .shell-panel {
    @apply rounded-3xl border border-shell-border bg-shell-panel shadow-sm;
  }

  .shell-toolbar {
    @apply flex flex-wrap items-center gap-3 rounded-2xl border border-shell-border bg-white px-4 py-3 shadow-sm;
  }

  .shell-section-title {
    @apply text-xl font-black tracking-tight text-gray-900 lg:text-2xl;
  }
}
```

- [ ] **Step 4: Add shared top navigation and button styles**

Add classes for the new primary navigation and top-level actions.

```css
.shell-nav-link {
  @apply inline-flex items-center rounded-xl px-4 py-2 text-sm font-bold text-gray-600 transition-colors;
}

.shell-nav-link-active {
  @apply bg-cnpc-red text-white shadow-sm;
}

.shell-nav-link-idle {
  @apply hover:bg-red-50 hover:text-cnpc-red;
}

.shell-primary-btn {
  @apply inline-flex items-center justify-center rounded-xl bg-cnpc-red px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-cnpc-red-dark;
}
```

- [ ] **Step 5: Preserve and extend the table/filter styles**

Keep the existing `cnpc-table` family but ensure it fits the new shell.

```css
.cnpc-table {
  @apply w-full border-collapse text-sm;
}

.cnpc-table th {
  @apply bg-table-header-bg text-table-header-text font-bold border border-table-border px-2 py-1.5 text-center whitespace-nowrap;
}

.cnpc-table td {
  @apply border border-table-border px-2 py-1 text-center text-gray-700 bg-white;
}
```

- [ ] **Step 6: Run type check to verify CSS-related imports still compile**

Run: `npm run lint`

Expected: `tsc --noEmit` completes without TypeScript errors caused by CSS class or import changes.

- [ ] **Step 7: Record checkpoint**

If a git repository exists:

```bash
git add src/index.css
git commit -m "feat: align shared shell theme tokens"
```

If no git repository exists, record a manual checkpoint by noting that Task 1 is complete in the plan file before continuing.

## Task 2: Replace Sidebar-First Shell With Top Navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/constants.ts`
- Test: `npm run lint`

- [ ] **Step 1: Normalize nav labels for top navigation readability**

Update `src/constants.ts` so the top navigation reads closer to the reference project.

```ts
export const NAV_ITEMS: NavItem[] = [
  { id: 'welcome', label: '欢迎' },
  { id: 'home', label: '主页' },
  { id: 'key-matters', label: '重点事项中心' },
  { id: 'dynamic-analysis', label: '动态分析' },
  { id: 'well-history', label: '单井井史' },
  { id: 'water-cut', label: '含水化验' },
  { id: 'injection-tech', label: '注水工艺' },
  { id: 'zonal-injection', label: '分注管理' },
  { id: 'well-flushing', label: '水井洗井' },
  { id: 'abnormal-wells', label: '异常水井' },
  { id: 'dynamic-adjustment', label: '动态调配' },
  { id: 'indicator-curve', label: '指示曲线' },
  { id: 'user-management', label: '用户管理' },
  { id: 'settings', label: '系统设置' },
  { id: 'audit-log', label: '审计日志' },
];
```

- [ ] **Step 2: Find the current app return shell and remove the sidebar wrapper**

In `src/App.tsx`, replace the current shell block:

```tsx
<div className="flex min-h-screen bg-[#f4f4f4] font-sans">
  <Sidebar activePage={activePage} onPageChange={setActivePage} />
  <div className="flex-1 flex flex-col min-w-0">
    <Header title={...} onPageChange={setActivePage} />
    <main className="flex-1 p-8 overflow-y-auto">
      ...
    </main>
  </div>
</div>
```

with a top-shell wrapper:

```tsx
<div className="shell-app font-sans">
  <TopNavigation activePage={activePage} onPageChange={setActivePage} />
  <main className="min-w-0">
    <div className={cn("shell-content", activePage === 'welcome' ? "max-w-[1800px]" : "max-w-[1700px]")}>
      {renderPage()}
    </div>
  </main>
  <footer className="border-t border-shell-border bg-white px-8 py-4">
    ...
  </footer>
</div>
```

- [ ] **Step 3: Add the new `TopNavigation` component inside `src/App.tsx`**

Implement a local component that reuses `NAV_ITEMS`, notification count, user info, and page switching.

```tsx
const TopNavigation = ({
  activePage,
  onPageChange,
}: {
  activePage: PageType;
  onPageChange: (page: PageType) => void;
}) => {
  const { systemConfig, unreadCount, user, isAuthenticated, logout } = useAuth();

  return (
    <div className="shell-topbar">
      <div className="shell-topbar-inner">
        <div className="mr-4 flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cnpc-red text-white shadow-sm">
            <Droplets className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-black tracking-tight text-gray-900">
              {systemConfig.systemName || '注水管理平台'}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-gray-400">
              Digital Intelligence Oilfield
            </div>
          </div>
        </div>

        <nav className="hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto lg:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                "shell-nav-link shrink-0",
                activePage === item.id ? "shell-nav-link-active" : "shell-nav-link-idle"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button className="relative rounded-xl bg-gray-100 p-2 text-gray-600 hover:bg-gray-200">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cnpc-red px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {isAuthenticated && user ? (
            <button
              onClick={logout}
              className="hidden rounded-xl border border-shell-border bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 lg:inline-flex"
            >
              {user.name}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Keep the floating window and toast inside the new shell**

After the new `main`, preserve the existing global overlays:

```tsx
<FloatingWindow isOpen={isFloatingOpen} onClose={() => setIsFloatingOpen(false)} onNavigate={setActivePage} />

{toast && (
  <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300">
    ...
  </div>
)}
```

- [ ] **Step 5: Run type check after replacing the shell**

Run: `npm run lint`

Expected: PASS with no missing component or prop errors after the new top navigation is wired in.

- [ ] **Step 6: Record checkpoint**

If a git repository exists:

```bash
git add src/App.tsx src/constants.ts
git commit -m "feat: replace sidebar shell with top navigation"
```

If no git repository exists, record a manual checkpoint by noting that Task 2 is complete in the plan file before continuing.

## Task 3: Re-skin Login, Welcome, And Shared Page Containers

**Files:**
- Modify: `src/App.tsx`
- Test: `npm run lint`

- [ ] **Step 1: Update the global loading screen to match the reference brand tone**

Replace the full-screen loader container classes with the red-white brand treatment:

```tsx
<div className="fixed inset-0 z-[203] flex flex-col items-center justify-center bg-cnpc-red">
  <div className="flex flex-col items-center">
    <div className="relative mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-2xl">
      <Droplets className="h-10 w-10 text-cnpc-red" />
    </div>
    <h2 className="mb-2 text-xl font-black tracking-tight text-white">注水生产运行管理平台</h2>
    <p className="mb-12 text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Digital Intelligence Oilfield</p>
  </div>
</div>
```

- [ ] **Step 2: Update the login modal shell to use the new panel system**

Replace the current login modal wrapper with a cleaner shell panel:

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.95, y: 20 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.95, y: 20 }}
  className="relative z-10 w-full max-w-md overflow-hidden rounded-[32px] border border-shell-border bg-white shadow-2xl"
>
  ...
</motion.div>
```

- [ ] **Step 3: Wrap protected and shared page states with the new shell panel classes**

Replace older page-shell wrappers such as:

```tsx
<div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-gray-100 shadow-sm">
```

with:

```tsx
<div className="shell-panel min-h-[60vh] p-8">
  <div className="flex h-full flex-col items-center justify-center text-center">
    ...
  </div>
</div>
```

- [ ] **Step 4: Update the common `main` page container spacing**

Ensure the app uses consistent wide-screen padding:

```tsx
<main className="min-w-0">
  <div className={cn("shell-content", activePage === 'welcome' ? "max-w-[1800px]" : "max-w-[1700px]")}>
    {renderPage()}
  </div>
</main>
```

- [ ] **Step 5: Run type check after login and container restyling**

Run: `npm run lint`

Expected: PASS with no JSX syntax or missing class-related regressions.

- [ ] **Step 6: Record checkpoint**

If a git repository exists:

```bash
git add src/App.tsx
git commit -m "feat: align login and page shell styling"
```

If no git repository exists, record a manual checkpoint by noting that Task 3 is complete in the plan file before continuing.

## Task 4: Align Shared Tables, Toolbars, And Footer Presentation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Test: `npm run lint`
- Test: `npm run build`

- [ ] **Step 1: Update the shared footer to match the reference platform tone**

Use a simpler white footer with muted metadata:

```tsx
<footer className="border-t border-shell-border bg-white px-8 py-4">
  <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-4">
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
      © 2026 高升采油厂注水管理平台 | PetroChina Style
    </p>
    <div className="flex gap-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">系统版本 v1.0.4</span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">安全等级: 高</span>
    </div>
  </div>
</footer>
```

- [ ] **Step 2: Convert page-level toolbar wrappers to use `.shell-toolbar` where applicable**

When encountering existing repeated wrappers like:

```tsx
<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
```

replace them with:

```tsx
<div className="shell-toolbar">
```

Use this only for compact filter and control rows, not for large content panels.

- [ ] **Step 3: Convert large content cards to use `.shell-panel`**

When encountering repeated wrappers like:

```tsx
<div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
```

replace them with:

```tsx
<div className="shell-panel overflow-hidden">
```

- [ ] **Step 4: Run type check after shared wrapper migration**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Run production build as the final shell regression check**

Run: `npm run build`

Expected: Vite build completes successfully and emits the production bundle without JSX or TypeScript shell regressions.

- [ ] **Step 6: Record checkpoint**

If a git repository exists:

```bash
git add src/App.tsx src/index.css
git commit -m "feat: align shared shell containers and footer"
```

If no git repository exists, record a manual checkpoint by noting that Task 4 is complete in the plan file before continuing.

## Task 5: Manual Verification Pass

**Files:**
- No code changes required unless regressions are found
- Test: local browser run against the development server

- [ ] **Step 1: Start the local app**

Run: `npm run dev`

Expected: The app serves locally without port or compilation errors in the intended workspace instance.

- [ ] **Step 2: Verify top navigation behavior**

Check these behaviors manually:

```text
1. The top navigation is visible on first load.
2. Clicking "欢迎", "主页", and "重点事项中心" changes pages.
3. The active page uses the red highlighted nav state.
```

Expected: PASS for all three checks.

- [ ] **Step 3: Verify shell visuals on key pages**

Check these pages manually:

```text
1. Welcome page
2. Home page
3. Key matters page
4. One table-heavy page such as 单井井史 or 含水化验
```

Expected: Each page shows the new top-shell frame, white content panels, and aligned table/header styling.

- [ ] **Step 4: Verify overlays and auth surfaces**

Check these behaviors manually:

```text
1. Login modal still opens and closes correctly.
2. Toast still appears above the shell.
3. Floating window still overlays the page without clipping.
4. Restricted pages still show the protected-access screen.
```

Expected: PASS for all four checks.

- [ ] **Step 5: Record final checkpoint**

If a git repository exists:

```bash
git add src/App.tsx src/index.css src/constants.ts
git commit -m "feat: align shell with top nav reference style"
```

If no git repository exists, record a manual checkpoint by noting that manual verification is complete and listing any remaining visual follow-ups.

## Self-Review

- Spec coverage:
  - Top navigation shell: covered in Task 2
  - Shared visual system: covered in Task 1 and Task 4
  - Login, welcome, home shell alignment: covered in Task 3
  - Validation and manual checks: covered in Task 4 and Task 5
- Placeholder scan:
  - No `TODO`, `TBD`, or undefined references remain in the plan
  - Commit steps include a no-git fallback because the current workspace is not a git repository
- Type consistency:
  - `TopNavigation`, `NAV_ITEMS`, `activePage`, `setActivePage`, `shell-panel`, and `shell-toolbar` names are used consistently across tasks
