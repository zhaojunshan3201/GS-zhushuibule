import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THEME, getBrowserTheme, getStoredTheme, isThemeKey, persistBrowserTheme, safeGetTheme, safePersistTheme, THEME_OPTIONS, THEME_STORAGE_KEY } from "../src/shared/theme";

test("declares the four selectable themes", () => {
  assert.equal(THEME_STORAGE_KEY, "gszhushui_theme");
  assert.deepEqual(THEME_OPTIONS.map((theme) => theme.key), ["default", "oil-blue", "enterprise-white", "emerald-gold"]);
  assert.deepEqual(THEME_OPTIONS.map((theme) => theme.label), ["当前默认主题", "中石油红", "极简企业白", "墨绿鎏金"]);
});

test("uses the emerald-gold palette for zonal table pagination links", () => {
  const app = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  assert.doesNotMatch(app, /text-\[#0000ee\]/);
  assert.match(app, /zonal-pagination-link/);
  assert.match(css, /\.shell-app\[data-theme="emerald-gold"\] \.zonal-pagination-link\s*\{\s*color: #174b3a !important;/);
});
test("accepts only a declared theme key", () => { assert.equal(isThemeKey("industrial-dark"), false); assert.equal(isThemeKey("unknown"), false); });
test("falls back to the default theme for missing or invalid storage", () => { assert.equal(getStoredTheme(null), DEFAULT_THEME); assert.equal(getStoredTheme("industrial-dark"), DEFAULT_THEME); assert.equal(getStoredTheme("emerald-gold"), "emerald-gold"); });

test("falls back to the default theme when storage reads throw", () => {
  assert.equal(safeGetTheme({ getItem: () => { throw new DOMException("Blocked", "SecurityError"); } }), DEFAULT_THEME);
});

test("ignores storage write failures", () => {
  assert.doesNotThrow(() => safePersistTheme({ setItem: () => { throw new DOMException("Full", "QuotaExceededError"); } }, "oil-blue"));
});

test("falls back when accessing browser storage throws", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, get: () => ({ get localStorage() { throw new DOMException("Blocked", "SecurityError"); } }) });
  try {
    assert.equal(getBrowserTheme(), DEFAULT_THEME);
    assert.doesNotThrow(() => persistBrowserTheme("oil-blue"));
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
import fs from "node:fs";

test("defines visual CSS contracts for every selectable theme", () => {
  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  for (const theme of ["oil-blue", "enterprise-white", "emerald-gold"]) {
    assert.match(css, new RegExp(`\\[data-theme=["']${theme}["']\\]`));
  }
});

test("preserves default visual constants while scoping theme overrides", () => {
  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  assert.match(css, /\.shell-primary-btn:hover\s*\{\s*background-color:\s*#c96b19;/);
  assert.match(css, /\.shell-link\s*\{\s*color:\s*#0000ee;/);
  assert.match(css, /\[data-theme="enterprise-white"\][\s\S]*?\.shell-welcome-card\s*\{\s*box-shadow:\s*none;/);
});

test("scopes visual overrides to non-default theme keys", () => {
  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /\[data-theme\] \.shell-(topbar-nav|primary-btn:hover|link)/);
});

test("does not apply theme text, table, or scrollbar overrides to the default theme", () => {
  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const themedRoot = ':is([data-theme="oil-blue"], [data-theme="enterprise-white"], [data-theme="emerald-gold"])';
  for (const selector of [".shell-section-title", ".cnpc-table td", ".custom-scrollbar::-webkit-scrollbar-track", ".custom-scrollbar::-webkit-scrollbar-thumb", ".custom-scrollbar::-webkit-scrollbar-thumb:hover"]) {
    assert.ok(css.includes(`${themedRoot} ${selector}`));
  }
});

test("uses one blue-gray table palette for the default theme", () => {
  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  assert.match(css, /\.shell-app\[data-theme="default"\] \.shell-content table th[\s\S]*?border-color: #acc6de !important;[\s\S]*?background-color: #e6f0f9 !important;/);
  assert.match(css, /\.shell-app\[data-theme="default"\] \.shell-content table td[\s\S]*?border-color: #acc6de !important;[\s\S]*?background-color: #ffffff !important;/);
  assert.match(css, /\.shell-app\[data-theme="default"\] \.zonal-table-shell[\s\S]*?border-color: #acc6de !important;/);
});
