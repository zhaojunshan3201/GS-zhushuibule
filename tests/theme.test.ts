import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THEME, getStoredTheme, isThemeKey, THEME_OPTIONS } from "../src/shared/theme";

test("declares the five selectable themes", () => { assert.deepEqual(THEME_OPTIONS.map((theme) => theme.key), ["default", "oil-blue", "enterprise-white", "industrial-dark", "emerald-gold"]); });
test("accepts only a declared theme key", () => { assert.equal(isThemeKey("industrial-dark"), true); assert.equal(isThemeKey("unknown"), false); });
test("falls back to the default theme for missing or invalid storage", () => { assert.equal(getStoredTheme(null), DEFAULT_THEME); assert.equal(getStoredTheme("unknown"), DEFAULT_THEME); assert.equal(getStoredTheme("emerald-gold"), "emerald-gold"); });