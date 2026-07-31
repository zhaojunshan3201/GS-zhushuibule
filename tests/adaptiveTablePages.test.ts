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

type AdaptiveRequestVisualState = {
  currentPage: number;
  records: Array<{ id: string }>;
  totalItems: number;
  selectedId: string | null;
  loading: boolean;
  error: string;
};

function beginAdaptiveRequest(state: AdaptiveRequestVisualState, targetPage: number): AdaptiveRequestVisualState {
  return {
    ...state,
    currentPage: targetPage,
    records: [],
    totalItems: 0,
    selectedId: null,
    loading: true,
    error: "",
  };
}

function rejectAdaptiveRequest(state: AdaptiveRequestVisualState, error: string): AdaptiveRequestVisualState {
  return { ...state, loading: false, error };
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
    /const\s+\[loading,\s*setLoading\]\s*=\s*useState\(false\)/,
    "page tracks whether the latest request is pending",
  );
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
    /\)\s*=>\s*\{\s*setCurrentPage\(page\);\s*setRecords\(\[\]\);\s*setTotalItems\(0\);\s*setSelectedId\(null\);\s*setLoading\(true\);\s*const\s+requestId\s*=\s*\+\+loadRequestIdRef\.current;[\s\S]*?await\s+axios\.get/,
    "loadRecords clears stale visuals after recording the target page and before requesting",
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
    /finally\s*\{\s*if\s*\(requestId\s*!==\s*loadRequestIdRef\.current\)\s*return;\s*setLoading\(false\);\s*\}/,
    "only the latest request leaves the pending state",
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
  assert.match(
    pageSource,
    /\{loading\s*&&\s*<tr><td[\s\S]*?\u52a0\u8f7d\u4e2d<\/td><\/tr>\}/,
    "table body renders an explicit pending row",
  );
  assert.match(
    pageSource,
    /\{!loading\s*&&\s*!error\s*&&\s*!records\.length\s*&&\s*<tr><td/,
    "table body only renders no-data state when neither loading nor failed",
  );
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
      ["pending records clear", pageSource.replace("setRecords([]);", "")],
      ["pending total clear", pageSource.replace("setTotalItems(0);", "")],
      ["pending selection clear", pageSource.replace("setSelectedId(null);", "")],
      ["pending loading state", pageSource.replace("setLoading(true);", "")],
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

for (const [pageName, totalSetter] of [
  ["AbnormalWellsPage", "setTotalItems"],
  ["WellFlushingPage", "setTotalRows"],
] as const) {
  test(`${pageName} uses shared adaptive server pagination`, async () => {
    const pageSource = getFunctionSource(await readFile(appUrl, "utf8"), pageName);
    const normalizedPageSource = pageSource.replaceAll(totalSetter, "setTotalItems");

    assertAdaptivePageContract(normalizedPageSource);
    assert.doesNotMatch(
      pageSource,
      /WELL_FLUSHING_PAGE_SIZE/,
      "well-flushing no longer uses its fixed main-table page size",
    );
    assert.match(
      pageSource,
      /const\s+displayPage\s*=\s*loading\s*\|\|\s*error\s*\?\s*currentPage\s*:\s*Math\.min\(currentPage,\s*totalPages\)/,
      "pending and failed requests keep showing their target page instead of clamping to the cleared total",
    );
  });
}

test("a rejected adaptive request never combines its target page with stale records", () => {
  const existingPage = {
    currentPage: 4,
    records: [{ id: "old-page-record" }],
    totalItems: 31,
    selectedId: "old-page-record",
    loading: false,
    error: "",
  };

  const pending = beginAdaptiveRequest(existingPage, 7);
  assert.deepEqual(pending, {
    currentPage: 7,
    records: [],
    totalItems: 0,
    selectedId: null,
    loading: true,
    error: "",
  });

  const failed = rejectAdaptiveRequest(pending, "request rejected");
  assert.deepEqual(failed, {
    currentPage: 7,
    records: [],
    totalItems: 0,
    selectedId: null,
    loading: false,
    error: "request rejected",
  });
});
