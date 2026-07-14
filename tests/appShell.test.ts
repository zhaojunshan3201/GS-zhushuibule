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
  assert.match(appSource, /aria-modal="true"/);
  assert.match(appSource, /aria-expanded=\{mobileNavOpen\}/);
  assert.match(appSource, /aria-controls="app-sidebar"/);
  assert.match(appSource, /isMobileViewport && !mobileNavOpen/);
  assert.match(appSource, /mobileMenuTriggerRef/);
  assert.match(appSource, /firstNavItemRef/);
  assert.match(appSource, /firstNavItemRef\.current\?\.focus\(\)/);
  assert.match(appSource, /mobileMenuTriggerRef\.current\?\.focus\(\)/);
  assert.match(appSource, /const closeMobileNav = \(\) =>/);
  assert.match(appSource, /aria-label="关闭导航菜单"/);
  assert.match(cssSource, /--color-shell-primary: #1a5276/);
  assert.match(cssSource, /\.shell-welcome-overlay/);
  assert.match(cssSource, /\.shell-topbar-inner\s*\{\s*@apply[^;]*h-\[60px\][^;]*;/);
});
