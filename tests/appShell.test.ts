import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const appAst = ts.createSourceFile("App.tsx", appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function descendants(node: ts.Node) {
  const nodes: ts.Node[] = [];
  const visit = (child: ts.Node) => {
    nodes.push(child);
    child.forEachChild(visit);
  };
  node.forEachChild(visit);
  return nodes;
}

function findFunction(name: string) {
  return appAst.statements.find(
    (statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
}

test("application shell retains content mounting while exposing reference layout regions", () => {
  assert.doesNotMatch(appSource, /showWelcome/);
  assert.match(appSource, /shell-sidebar/);
  assert.match(appSource, /shell-topbar/);
  assert.match(appSource, /<AppContent/);
  assert.doesNotMatch(appSource, /aria-modal="true"/);
  assert.match(appSource, /aria-expanded=\{mobileNavOpen\}/);
  assert.match(appSource, /aria-controls="app-sidebar"/);
  assert.match(appSource, /isMobileViewport && !mobileNavOpen/);
  assert.match(appSource, /mobileMenuTriggerRef/);
  assert.match(appSource, /firstNavItemRef/);
  assert.match(appSource, /firstNavItemRef\.current\?\.focus\(\)/);
  assert.match(appSource, /mobileMenuTriggerRef\.current\?\.focus\(\)/);
  assert.match(appSource, /const closeMobileNav = \(\) =>/);
  assert.match(appSource, /aria-label="关闭导航菜单"/);
  assert.match(appSource, /getBrowserTheme/);
  assert.match(appSource, /persistBrowserTheme/);
  assert.match(appSource, /data-theme=\{theme\}/);
  assert.match(appSource, /主题切换/);
  assert.match(appSource, /theme-switcher/);
  assert.match(appSource, /function LoginDialog\(\{ theme, onLogin, onCancel \}/);
  assert.match(appSource, /<LoginDialog\s+theme=\{theme\}/);
  assert.match(appSource, /activePage === "home"/);
  assert.match(appSource, /icon: Home/);
  assert.match(appSource, /const NavIcon = item\.icon/);
  assert.match(appSource, /<NavIcon className="h-\[18px\] w-\[18px\] shrink-0"/);
  assert.match(cssSource, /--color-shell-primary: #1a5276/);
  assert.match(cssSource, /sidebar-oilfield\.png/);
  assert.match(cssSource, /\.shell-app\[data-theme="default"\] \.shell-sidebar::after/);
  assert.match(cssSource, /mask-image: linear-gradient\(to bottom, transparent 0%, black 34%, black 100%\)/);
  assert.match(cssSource, /\.shell-app\[data-theme="default"\] \.shell-nav-link-active/);
  assert.match(cssSource, /\.shell-app\[data-theme="enterprise-white"\] \.shell-sidebar/);
  assert.match(cssSource, /\.shell-app\[data-theme="enterprise-white"\] \.shell-nav-link-active/);
  assert.match(cssSource, /\.shell-app\[data-theme="enterprise-white"\] \.shell-sidebar-nav > \.shell-nav-link > svg/);
  assert.match(appSource, /home-reserve-overview/);
  assert.match(cssSource, /\.shell-app\[data-theme="enterprise-white"\] \.home-reserve-overview/);
  assert.match(cssSource, /\.shell-app\[data-theme="enterprise-white"\] \.home-reserve-overview th/);
  assert.match(cssSource, /\.shell-app\[data-theme="enterprise-white"\] \.home-reserve-overview td/);
  assert.match(cssSource, /border-color: #dbe4ee !important/);
  assert.match(cssSource, /\.shell-app\[data-theme="enterprise-white"\] table th/);
  assert.match(cssSource, /\.shell-app\[data-theme="enterprise-white"\] table td/);
  assert.doesNotMatch(cssSource, /industrial-dark/);
  assert.match(cssSource, /\.login-dialog\[data-theme="enterprise-white"\][\s\S]*?--login-hero: #f8fbff/);
  assert.match(cssSource, /\.shell-app\[data-theme="emerald-gold"\] table th/);
  assert.match(cssSource, /\.shell-app\[data-theme="emerald-gold"\] table td/);
  assert.match(appSource, /zonal-table-shell/);
  assert.match(cssSource, /\.shell-app\[data-theme="emerald-gold"\] \.zonal-table-shell/);
  assert.match(cssSource, /\.shell-app\[data-theme="emerald-gold"\] \.shell-content \[class\*="border-\[#"\]/);
  assert.doesNotMatch(cssSource, /\.shell-welcome-overlay/);
  assert.match(cssSource, /\.shell-topbar-inner\s*\{\s*@apply[^;]*h-\[60px\][^;]*;/);
  assert.match(cssSource, /@media \(max-width: 1023px\)[\s\S]*?\.theme-switcher span\s*\{\s*display:\s*none;/);
  assert.match(cssSource, /@media \(max-width: 1023px\)[\s\S]*?\.theme-switcher select\s*\{\s*max-width:\s*120px;/);
  assert.match(cssSource, /@media \(max-width: 639px\)\s*\{\s*\.theme-switcher\s*\{\s*display:\s*none;/);
});

test("well history actions live in the sidebar and import completion reports overwritten files", () => {
  const sidebarMarker = appSource.indexOf("data-well-history-sidebar");
  const contentMarker = appSource.indexOf("data-well-history-content");

  assert.notEqual(sidebarMarker, -1);
  assert.notEqual(contentMarker, -1);
  assert.ok(sidebarMarker < contentMarker);

  const sidebarSource = appSource.slice(sidebarMarker, contentMarker);
  assert.match(sidebarSource, /handleQuery/);
  assert.match(sidebarSource, /saveRichTextDocument/);
  assert.match(sidebarSource, /handleRichTextPdfDownload/);
  assert.match(sidebarSource, /作业区/);
  assert.match(sidebarSource, /<option value="">全部单位<\/option>/);
  assert.match(sidebarSource, /<option value="">全部区块<\/option>/);
  assert.match(sidebarSource, /FILTER_UNIT_OPTIONS\.map/);
  assert.match(sidebarSource, /getFilterBlockOptions\(unit\)/);
  const importIndex = sidebarSource.indexOf("fileInputRef.current?.click()");
  const currentIndex = sidebarSource.indexOf("handleQuery");
  const archiveIndex = sidebarSource.indexOf("archives.map((item)");
  assert.notEqual(importIndex, -1);
  assert.notEqual(currentIndex, -1);
  assert.notEqual(archiveIndex, -1);
  assert.ok(importIndex < currentIndex && currentIndex < archiveIndex);

  const wellHistoryPageEndMatch = appSource.slice(contentMarker).match(/\r?\n}\r?\n\r?\nconst formatDateOnly/);
  assert.ok(wellHistoryPageEndMatch?.index !== undefined);
  const wellHistoryPageEnd = contentMarker + wellHistoryPageEndMatch.index;
  const contentSource = appSource.slice(contentMarker, wellHistoryPageEnd);
  assert.doesNotMatch(contentSource, /handleQuery/);
  assert.doesNotMatch(contentSource, /saveRichTextDocument/);
  assert.doesNotMatch(contentSource, /handleRichTextPdfDownload/);

  assert.match(appSource, /supersededCount:\s*number/);
  assert.match(appSource, /data\.supersededCount/);
});

test("well history PPT imports are deduplicated and uploaded in automatic batches", () => {
  assert.match(appSource, /createWellHistoryImportBatches/);
  assert.match(appSource, /normalizeWellHistoryWellNo/);
  assert.match(appSource, /parseWellHistoryImportFileName/);
  assert.match(appSource, /selectLatestWellHistoryImports/);
  assert.match(appSource, /WELL_HISTORY_BATCH_MAX_BYTES/);
  assert.match(appSource, /WELL_HISTORY_BATCH_MAX_FILES/);
  assert.match(appSource, /candidate\.size > WELL_HISTORY_BATCH_MAX_BYTES/);
  assert.match(appSource, /自动分批单文件上限.*48MB/);
  assert.match(appSource, /batches\.entries\(\)/);
  assert.match(appSource, /batch-request-failed/);
  assert.match(appSource, /正在导入第 \$\{batchIndex \+ 1\}\/\$\{batches\.length\} 批/);
  assert.match(appSource, /supersededCount/);
});

test("styled confirmations support an optional cancellation action", () => {
  const hook = findFunction("useStyledConfirmDialog");
  assert.ok(hook?.body);

  const requestConfirm = descendants(hook).find(
    (node): node is ts.VariableDeclaration => ts.isVariableDeclaration(node) && node.name.getText(appAst) === "requestConfirm",
  );
  assert.ok(requestConfirm?.initializer && ts.isArrowFunction(requestConfirm.initializer));
  const cancelParameter = requestConfirm.initializer.parameters[2];
  assert.equal(cancelParameter?.name.getText(appAst), "onCancel");
  assert.ok(cancelParameter.questionToken, "onCancel must remain optional");

  const hookSource = hook.getText(appAst);
  assert.match(hookSource, /onCancel:\s*\(\) => void \| Promise<void>/);
  assert.match(hookSource, /setPendingConfirm\(\{ message, onConfirm, onCancel:/);
  assert.match(hookSource, /const action = pendingConfirm\.onCancel;[\s\S]*?setPendingConfirm\(null\);[\s\S]*?void action\(\);/);
});

test("well history import summary opens the first success after confirm or cancel", () => {
  const page = findFunction("WellHistoryPage");
  assert.ok(page?.body);

  const pageNodes = descendants(page);
  const openFirstSuccess = pageNodes.find(
    (node): node is ts.VariableDeclaration => ts.isVariableDeclaration(node) && node.name.getText(appAst) === "openFirstSuccess",
  );
  assert.ok(openFirstSuccess?.initializer);
  assert.match(openFirstSuccess.initializer.getText(appAst), /openWell\(firstSuccess\.wellNo\)/);

  const summaryConfirm = pageNodes.find((node): node is ts.CallExpression => {
    if (!ts.isCallExpression(node) || node.expression.getText(appAst) !== "requestConfirm") return false;
    return node.arguments[0]?.getText(appAst).includes("PPT 导入完成") ?? false;
  });
  assert.ok(summaryConfirm);
  assert.equal(summaryConfirm.arguments[1]?.getText(appAst), "openFirstSuccess");
  assert.equal(summaryConfirm.arguments[2]?.getText(appAst), "openFirstSuccess");
});
