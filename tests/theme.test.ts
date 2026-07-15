import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THEME, getStoredTheme, isThemeKey, safeGetTheme, safePersistTheme, THEME_OPTIONS, THEME_STORAGE_KEY } from "../src/shared/theme";

test("declares the five selectable themes", () => {
  assert.equal(THEME_STORAGE_KEY, "gszhushui_theme");
  assert.deepEqual(THEME_OPTIONS.map((theme) => theme.key), ["default", "oil-blue", "enterprise-white", "industrial-dark", "emerald-gold"]);
  assert.deepEqual(THEME_OPTIONS.map((theme) => theme.label), ["当前默认主题", "专业油田蓝", "极简企业白", "深色工业台", "墨绿鎏金"]);
});
test("accepts only a declared theme key", () => { assert.equal(isThemeKey("industrial-dark"), true); assert.equal(isThemeKey("unknown"), false); });
test("falls back to the default theme for missing or invalid storage", () => { assert.equal(getStoredTheme(null), DEFAULT_THEME); assert.equal(getStoredTheme("unknown"), DEFAULT_THEME); assert.equal(getStoredTheme("emerald-gold"), "emerald-gold"); });

test("falls back to the default theme when storage reads throw", () => {
  assert.equal(safeGetTheme({ getItem: () => { throw new DOMException("Blocked", "SecurityError"); } }), DEFAULT_THEME);
});

test("ignores storage write failures", () => {
  assert.doesNotThrow(() => safePersistTheme({ setItem: () => { throw new DOMException("Full", "QuotaExceededError"); } }, "oil-blue"));
});
import fs from "node:fs";

test("defines visual CSS contracts for every selectable theme", () => {
  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  for (const theme of ["oil-blue", "enterprise-white", "industrial-dark", "emerald-gold"]) {
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
  const themedRoot = ':is([data-theme="oil-blue"], [data-theme="enterprise-white"], [data-theme="industrial-dark"], [data-theme="emerald-gold"])';
  for (const selector of [".shell-section-title", ".cnpc-table td", ".custom-scrollbar::-webkit-scrollbar-track", ".custom-scrollbar::-webkit-scrollbar-thumb", ".custom-scrollbar::-webkit-scrollbar-thumb:hover"]) {
    assert.ok(css.includes(`${themedRoot} ${selector}`));
  }
});
