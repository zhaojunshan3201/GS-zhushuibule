import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THEME, getStoredTheme, isThemeKey, THEME_OPTIONS, THEME_STORAGE_KEY } from "../src/shared/theme";

test("declares the five selectable themes", () => {
  assert.equal(THEME_STORAGE_KEY, "gszhushui_theme");
  assert.deepEqual(THEME_OPTIONS.map((theme) => theme.key), ["default", "oil-blue", "enterprise-white", "industrial-dark", "emerald-gold"]);
  assert.deepEqual(THEME_OPTIONS.map((theme) => theme.label), ["当前默认主题", "专业油田蓝", "极简企业白", "深色工业台", "墨绿鎏金"]);
});
test("accepts only a declared theme key", () => { assert.equal(isThemeKey("industrial-dark"), true); assert.equal(isThemeKey("unknown"), false); });
test("falls back to the default theme for missing or invalid storage", () => { assert.equal(getStoredTheme(null), DEFAULT_THEME); assert.equal(getStoredTheme("unknown"), DEFAULT_THEME); assert.equal(getStoredTheme("emerald-gold"), "emerald-gold"); });
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
