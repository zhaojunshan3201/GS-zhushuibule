import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const appUrl = new URL("../src/App.tsx", import.meta.url);

function getFunctionSource(source: string, functionName: string) {
  const ast = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const page = ast.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === functionName,
  );

  assert.ok(page, `${functionName} function must exist`);
  return source.slice(page.getStart(ast), page.getEnd());
}

function assertAdaptivePageContract(pageSource: string) {
  assert.match(pageSource, /useAdaptiveTablePagination\s*\(/, "page uses the shared adaptive pagination hook");
  assert.match(
    pageSource,
    /const\s*\{[^}]*\bcurrentPageRef\b[^}]*\}\s*=\s*useAdaptiveTablePagination\s*\(/,
    "page gets currentPageRef from the shared hook",
  );
  assert.match(
    pageSource,
    /const\s*\{[^}]*\bpageSizeRef\b[^}]*\}\s*=\s*useAdaptiveTablePagination\s*\(/,
    "page gets pageSizeRef from the shared hook",
  );
  assert.match(pageSource, /const\s+filtersRef\s*=\s*useRef\(filters\)/, "page keeps the latest filters in a ref");
  assert.match(
    pageSource,
    /const\s+loadRecords\s*=\s*useCallback\s*\(\s*async\s*\([\s\S]*?requestedPageSize\s*=\s*pageSizeRef\.current/,
    "loadRecords is stable and defaults requestedPageSize from pageSizeRef.current",
  );
  assert.match(pageSource, /pageSize\s*:\s*requestedPageSize/, "API request explicitly uses requestedPageSize");
  assert.match(pageSource, /const\s+loadRequestIdRef\s*=\s*useRef\(0\)/, "page tracks the latest load request");
  assert.match(
    pageSource,
    /await\s+axios\.get[\s\S]*?if\s*\(requestId\s*!==\s*loadRequestIdRef\.current\)\s*return;[\s\S]*?setRecords\(/,
    "success commits records only for the latest request",
  );
  assert.match(
    pageSource,
    /catch\s*\([^)]*\)\s*\{\s*if\s*\(requestId\s*!==\s*loadRequestIdRef\.current\)\s*return;\s*setError\(/,
    "failure commits an error only for the latest request",
  );
  assert.match(
    pageSource,
    /useEffect\s*\(\s*\(\)\s*=>\s*\{\s*void\s+loadRecords\(\s*currentPageRef\.current\s*,\s*filtersRef\.current\s*,\s*pageSize\s*\);\s*\},\s*\[\s*loadRecords\s*,\s*pageSize\s*\]\s*\)/,
    "page reloads the current page and filters when adaptive capacity changes",
  );
  assert.match(pageSource, /ref=\{tablePageRef\}/, "table shell is wrapped by the measurement ref");
  assert.doesNotMatch(pageSource, /const\s+pageSize\s*=\s*\d+(?:\.\d+)?\b/, "page has no fixed numeric page size");
  assert.doesNotMatch(
    pageSource,
    /addEventListener\(\s*["']resize["']/,
    "page delegates resize handling to the shared hook",
  );
}

for (const pageName of [
  "ConcentricTestHistoryPage",
  "SmartTestHistoryPage",
  "SingleWellInjectionEvaluationPage",
  "SingleWellSealEvaluationPage",
]) {
  test(`${pageName} uses shared adaptive server pagination`, async () => {
    const pageSource = getFunctionSource(await readFile(appUrl, "utf8"), pageName);

    assertAdaptivePageContract(pageSource);

    const mutatedPageSource = pageSource.replace(
      "requestedPageSize = pageSizeRef.current",
      "requestedPageSize = 10",
    );
    assert.notEqual(mutatedPageSource, pageSource, "mutation must remove a required contract fragment");
    assert.throws(
      () => assertAdaptivePageContract(mutatedPageSource),
      /defaults requestedPageSize from pageSizeRef\.current/,
      "contract assertions catch a fixed request-size mutation",
    );
  });
}
