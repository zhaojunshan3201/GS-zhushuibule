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
  assert.match(
    pageSource,
    /const\s*\{[^}]*\bisMeasured\b[^}]*\}\s*=\s*useAdaptiveTablePagination\s*\(/,
    "page gets measurement readiness from the shared hook",
  );
  assert.match(
    pageSource,
    /const\s+appliedFiltersRef\s*=\s*useRef\(filters\)/,
    "page keeps only applied filters in a ref",
  );
  assert.match(pageSource, /const\s+recordsRef\s*=\s*useRef\(records\)/, "page keeps latest records in a ref");
  assert.match(
    pageSource,
    /useEffect\s*\(\s*\(\)\s*=>\s*\{\s*recordsRef\.current\s*=\s*records;\s*\},\s*\[\s*records\s*\]\s*\)/,
    "page synchronizes latest records after commit",
  );
  assert.match(
    pageSource,
    /const\s+loadRecords\s*=\s*useCallback\s*\(\s*async\s*\([\s\S]*?nextFilters\s*=\s*appliedFiltersRef\.current[\s\S]*?requestedPageSize\s*=\s*pageSizeRef\.current/,
    "loadRecords is stable and defaults requestedPageSize from pageSizeRef.current",
  );
  assert.match(
    pageSource,
    /\)\s*=>\s*\{\s*setCurrentPage\(page\);\s*const\s+requestId\s*=\s*\+\+loadRequestIdRef\.current;[\s\S]*?await\s+axios\.get/,
    "loadRecords records the target page before starting its request",
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
    /useEffect\s*\(\s*\(\)\s*=>\s*\{\s*if\s*\(!isMeasured\)\s*return;\s*void\s+loadRecords\(\s*currentPageRef\.current\s*,\s*appliedFiltersRef\.current\s*,\s*pageSize\s*\);\s*\},\s*\[\s*isMeasured\s*,\s*loadRecords\s*,\s*pageSize\s*\]\s*\)/,
    "page reloads the current page and filters when adaptive capacity changes",
  );
  assert.match(
    pageSource,
    /onClick=\{\(\)\s*=>\s*\{\s*appliedFiltersRef\.current\s*=\s*filters;\s*void\s+loadRecords\(1,\s*filters\);\s*\}\}>确定<\/button>/,
    "confirm applies draft filters before loading them",
  );
  assert.equal(
    pageSource.match(/appliedFiltersRef\.current\s*=\s*filters/g)?.length,
    1,
    "draft filters are applied only by confirm",
  );
  assert.doesNotMatch(
    pageSource,
    /filtersRef\.current\s*=\s*filters/,
    "page has no render-time legacy filter synchronization",
  );
  assert.match(
    pageSource,
    /await\s+axios\.delete[\s\S]*?const\s+latestRecords\s*=\s*recordsRef\.current;\s*const\s+latestPage\s*=\s*currentPageRef\.current;[\s\S]*?latestRecords\.length\s*===\s*1[\s\S]*?latestRecords\[0\]\?\.id\s*===\s*record\.id[\s\S]*?await\s+loadRecords\(nextPage\)/,
    "delete refreshes from latest records and page refs",
  );
  assert.doesNotMatch(
    pageSource,
    /await\s+axios\.delete[\s\S]*?records\.length\s*===\s*1\s*&&\s*currentPage\s*>\s*1/,
    "delete does not derive its refresh page from stale closures",
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

    for (const [description, mutated] of [
      ["target-page intent", pageSource.replace("setCurrentPage(page);", "")],
      ["applied filters", pageSource.replace("appliedFiltersRef.current = filters;", "")],
      [
        "draft filter render write",
        pageSource.replace(
          "const loadRecords =",
          "appliedFiltersRef.current = filters;\n\n  const loadRecords =",
        ),
      ],
      ["latest delete refs", pageSource.replaceAll("recordsRef.current", "records")],
    ]) {
      assert.notEqual(mutated, pageSource, `${description} mutation must remove a required fragment`);
      assert.throws(
        () => assertAdaptivePageContract(mutated),
        undefined,
        `contract assertions catch the ${description} mutation`,
      );
    }
  });
}
