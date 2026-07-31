import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const appUrl = new URL("../src/App.tsx", import.meta.url);

function getSmartTestHistoryPageSource(source: string) {
  const ast = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const page = ast.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "SmartTestHistoryPage",
  );

  assert.ok(page, "SmartTestHistoryPage function must exist");
  return source.slice(page.getStart(ast), page.getEnd());
}

test("SmartTestHistoryPage uses viewport-adaptive server pagination", async () => {
  const pageSource = getSmartTestHistoryPageSource(await readFile(appUrl, "utf8"));

  assert.match(pageSource, /useAdaptiveTablePagination\s*\(/);
  assert.match(pageSource, /pageSize\s*:\s*requestedPageSize/);
  assert.doesNotMatch(pageSource, /const\s+pageSize\s*=\s*10\b/);
  assert.match(pageSource, /min-w-\[1820px\]/);
});

test("SmartTestHistoryPage only lets the latest records request commit state", async () => {
  const pageSource = getSmartTestHistoryPageSource(await readFile(appUrl, "utf8"));

  assert.match(pageSource, /const\s+loadRequestIdRef\s*=\s*useRef\(0\)/);
  assert.match(pageSource, /const\s+requestId\s*=\s*\+\+loadRequestIdRef\.current/);
  assert.match(
    pageSource,
    /await\s+axios\.get[\s\S]*?if\s*\(requestId\s*!==\s*loadRequestIdRef\.current\)\s*return;[\s\S]*?setRecords\(/,
  );
  assert.match(
    pageSource,
    /catch\s*\([^)]*\)\s*{\s*if\s*\(requestId\s*!==\s*loadRequestIdRef\.current\)\s*return;\s*setError\(/,
  );
});
