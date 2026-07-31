import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { getAdaptivePaginationView } from "../src/shared/adaptiveTablePagination";

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
    selectedId: null,
    loading: true,
    error: "",
  };
}

function rejectAdaptiveRequest(state: AdaptiveRequestVisualState, error: string): AdaptiveRequestVisualState {
  return { ...state, loading: false, error };
}

function assertAdaptivePageContract(pageSource: string, clearsCommittedTotal = true) {
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
  const requestStartPattern = clearsCommittedTotal
    ? /\)\s*=>\s*\{\s*setCurrentPage\(page\);\s*setRecords\(\[\]\);\s*setTotalItems\(0\);\s*setSelectedId\(null\);\s*setLoading\(true\);\s*const\s+requestId\s*=\s*\+\+loadRequestIdRef\.current;[\s\S]*?await\s+axios\.get/
    : /\)\s*=>\s*\{\s*setCurrentPage\(page\);\s*setRecords\(\[\]\);\s*setSelectedId\(null\);\s*setLoading\(true\);\s*const\s+requestId\s*=\s*\+\+loadRequestIdRef\.current;[\s\S]*?await\s+axios\.get/;
  assert.match(pageSource, requestStartPattern, "loadRecords clears stale rows but preserves committed pagination metadata");
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

    assertAdaptivePageContract(normalizedPageSource, false);
    assert.match(pageSource, /getAdaptivePaginationView\s*\(/, "page derives all controls from one pagination view");
    assert.match(pageSource, /void\s+loadRecords\(clampPage\(page\)\)/, "page navigation uses the shared displayed boundary");
    assert.match(pageSource, /disabled=\{!canGoPrevious\}/, "previous controls use the shared displayed boundary");
    assert.match(pageSource, /disabled=\{!canGoNext\}/, "next controls use the shared displayed boundary");
    assert.doesNotMatch(pageSource, new RegExp(`${totalSetter}\\(0\\)`), "pending keeps the last committed total");
    assert.doesNotMatch(
      pageSource,
      /WELL_FLUSHING_PAGE_SIZE/,
      "well-flushing no longer uses its fixed main-table page size",
    );
  });
}

function assertAdaptiveOperationsPageContract(pageSource: string, pageKind: "injection" | "water-cut") {
  assert.match(pageSource, /useAdaptiveTablePagination\s*\(/, "page uses the shared adaptive pagination hook");
  assert.match(pageSource, /\bcurrentPageRef\b/, "page gets currentPageRef from the shared hook");
  assert.match(pageSource, /\bpageSizeRef\b/, "page gets pageSizeRef from the shared hook");
  assert.match(pageSource, /\bisMeasured\b/, "page waits for the first viewport measurement");
  assert.match(pageSource, /const\s+appliedFiltersRef\s*=\s*useRef\(filters\)/, "draft and applied filters are separate");
  assert.match(pageSource, /const\s+recordsRef\s*=\s*useRef\(records\)/, "delete reads the latest committed rows");
  assert.match(pageSource, /const\s+loadRequestIdRef\s*=\s*useRef\(0\)/, "page tracks the latest list request");
  assert.match(
    pageSource,
    /const\s+loadRecords\s*=\s*useCallback\s*\(\s*async\s*\([\s\S]*?page\s*=\s*currentPageRef\.current[\s\S]*?nextFilters\s*=\s*appliedFiltersRef\.current[\s\S]*?requestedPageSize\s*=\s*pageSizeRef\.current/,
    "list loading takes stable page, applied filters, and adaptive size defaults",
  );
  assert.match(
    pageSource,
    /setCurrentPage\(page\);\s*setRecords\(\[\]\);[\s\S]*?setLoading\(true\);[\s\S]*?const\s+requestId\s*=\s*\+\+loadRequestIdRef\.current/,
    "a pending request records target-page intent and clears stale rows",
  );
  assert.doesNotMatch(pageSource, /setTotalRows\(0\)/, "a pending or failed request preserves the committed total boundary");
  assert.match(pageSource, /pageSize\s*:\s*requestedPageSize/, "main-table requests use the measured page size");
  assert.match(
    pageSource,
    /await\s+axios\.get[\s\S]*?if\s*\(requestId\s*!==\s*loadRequestIdRef\.current\)\s*return;[\s\S]*?setRecords\(/,
    "only the latest successful list request commits rows",
  );
  assert.match(
    pageSource,
    /catch\s*\([^)]*\)\s*\{\s*if\s*\(requestId\s*!==\s*loadRequestIdRef\.current\)\s*return;\s*setError\(/,
    "only the latest failed list request commits an error",
  );
  assert.match(
    pageSource,
    /finally\s*\{\s*if\s*\(requestId\s*!==\s*loadRequestIdRef\.current\)\s*return;\s*setLoading\(false\);\s*\}/,
    "only the latest list request clears pending state",
  );
  assert.match(
    pageSource,
    /useEffect\s*\(\s*\(\)\s*=>\s*\{\s*if\s*\(!isMeasured\)\s*return;\s*void\s+loadRecords\(currentPageRef\.current,\s*appliedFiltersRef\.current,\s*pageSize\);\s*\},\s*\[isMeasured,\s*loadRecords,\s*pageSize\]\s*\)/,
    "capacity changes reload the intended page with applied filters",
  );
  assert.match(pageSource, /getAdaptivePaginationView\s*\(/, "all controls share one committed pagination boundary");
  assert.match(pageSource, /void\s+loadRecords\(clampPage\(page\)\)/, "navigation clamps against that shared boundary");
  assert.match(pageSource, /disabled=\{!canGoPrevious\}/, "previous control uses the shared boundary");
  assert.match(pageSource, /disabled=\{!canGoNext\}/, "next control uses the shared boundary");
  assert.match(pageSource, /ref=\{tablePageRef\}/, "the page shell is measurable");
  assert.match(pageSource, /\{loading\s*&&\s*\(/, "the table renders an explicit pending row");
  assert.match(pageSource, /\{!loading\s*&&\s*!error\s*&&/, "no-data appears only outside pending and error states");
  assert.match(
    pageSource,
    /await\s+axios\.delete[\s\S]*?const\s+latestRecords\s*=\s*recordsRef\.current;\s*const\s+latestPage\s*=\s*currentPageRef\.current;/,
    "delete refreshes from latest refs instead of stale closures",
  );
  assert.doesNotMatch(pageSource, /const\s+\[appliedFilters,\s*setAppliedFilters\]/, "applied filters are not render state");

  if (pageKind === "injection") {
    assert.match(pageSource, /\.slice\(0,\s*pageSize\)/, "the pinned-first-page view respects adaptive capacity");
    assert.match(pageSource, /\(displayPage\s*-\s*1\)\s*\*\s*pageSize\s*\+\s*index\s*\+\s*1/, "row numbering uses adaptive capacity");
    assert.match(pageSource, /setPinnedRecord\(null\)/, "pending requests clear the pinned row from the old view");
    assert.match(
      pageSource,
      /buildPinnedAdaptivePage\(\s*createdRecord,\s*recordsRef\.current,\s*pageSizeRef\.current,?\s*\)/,
      "create completion pins against the records and capacity current after any resize",
    );
  } else {
    assert.match(pageSource, /\(displayPage\s*-\s*1\)\s*\*\s*pageSize\s*\+\s*index\s*\+\s*1/, "row numbering uses adaptive capacity");
    assert.match(pageSource, /pageSize:\s*50/, "the independent water-cut trend query keeps its larger history limit");
  }
}

for (const [pageName, pageKind] of [
  ["InjectionTechPage", "injection"],
  ["WaterCutPage", "water-cut"],
] as const) {
  test(`${pageName} uses shared adaptive server pagination`, async () => {
    const pageSource = getFunctionSource(await readFile(appUrl, "utf8"), pageName);
    assertAdaptiveOperationsPageContract(pageSource, pageKind);
  });
}

test("injection-tech and water-cut main tables no longer define fixed capacities", async () => {
  const source = await readFile(appUrl, "utf8");
  assert.doesNotMatch(source, /INJECTION_TECH_PAGE_SIZE/);
  assert.doesNotMatch(source, /WATER_CUT_PAGE_SIZE/);
});

test("indicator curve uses adaptive race-safe server pagination without changing auxiliary limits", async () => {
  const pageSource = getFunctionSource(await readFile(appUrl, "utf8"), "IndicatorCurvePage");

  assert.match(pageSource, /useAdaptiveTablePagination\s*\(\s*\)/);
  assert.match(pageSource, /\bcurrentPageRef\b/);
  assert.match(pageSource, /\bpageSizeRef\b/);
  assert.match(pageSource, /\bisMeasured\b/);
  assert.match(pageSource, /const\s+appliedFiltersRef\s*=\s*useRef\(filters\)/);
  assert.match(pageSource, /const\s+recordsRef\s*=\s*useRef\(records\)/);
  assert.match(pageSource, /const\s+loadRequestIdRef\s*=\s*useRef\(0\)/);
  assert.match(pageSource, /const\s+\[loading,\s*setLoading\]\s*=\s*useState\(false\)/);
  assert.match(pageSource, /getAdaptivePaginationView\s*\(/);
  assert.match(
    pageSource,
    /const\s+loadRecords\s*=\s*useCallback\s*\(\s*async\s*\([\s\S]*?page\s*=\s*currentPageRef\.current[\s\S]*?nextFilters\s*=\s*appliedFiltersRef\.current[\s\S]*?requestedPageSize\s*=\s*pageSizeRef\.current/,
  );
  assert.match(
    pageSource,
    /setCurrentPage\(page\);\s*setJumpPage\(String\(page\)\);\s*setRecords\(\[\]\);\s*setSelectedCurveIds\(\[\]\);\s*setLoading\(true\);\s*const\s+requestId\s*=\s*\+\+loadRequestIdRef\.current/,
  );
  assert.doesNotMatch(pageSource, /setTotalRows\(0\)/, "pending and failure preserve the committed total boundary");
  assert.match(pageSource, /pageSize:\s*requestedPageSize/);
  assert.match(pageSource, /if\s*\(requestId\s*!==\s*loadRequestIdRef\.current\)\s*return;/);
  assert.match(
    pageSource,
    /if\s*\(!isMeasured\)\s*return;\s*void\s+loadRecords\(currentPageRef\.current,\s*appliedFiltersRef\.current,\s*pageSize\)/,
  );
  assert.match(pageSource, /appliedFiltersRef\.current\s*=\s*filters;\s*setAppliedFilters\(filters\);\s*void\s+loadRecords\(1,\s*filters\)/);
  assert.match(pageSource, /void\s+loadRecords\(clampPage\(page\)\)/);
  assert.match(pageSource, /setJumpPage\(String\(page\)\)/, "pending navigation keeps the jump control on the target page");
  assert.match(pageSource, /<span>\u7b2c\{displayPage\}\u9875/, "pagination text uses the shared displayed page");
  assert.match(pageSource, /disabled=\{!canGoPrevious\}/);
  assert.match(pageSource, /disabled=\{!canGoNext\}/);
  assert.match(pageSource, /const\s+latestRecords\s*=\s*recordsRef\.current;\s*const\s+latestPage\s*=\s*currentPageRef\.current;/);
  assert.match(pageSource, /length:\s*Math\.max\(0,\s*pageSize\s*-\s*records\.length\)/);
  assert.match(pageSource, /aria-hidden="true"/);
  assert.match(pageSource, />\u52a0\u8f7d\u4e2d<\/td>/, "pending state has readable loading text");
  assert.match(pageSource, /ref=\{tablePageRef\}/);
  assert.doesNotMatch(pageSource, /max-h-\[540px\]/, "the adaptive table is not capped at the former fixed height");
  assert.doesNotMatch(
    pageSource,
    /className="[^"]*\boverflow-auto\b[^"]*"/,
    "the main table does not create a fixed vertical scrolling viewport",
  );
  assert.match(pageSource, /className="[^"]*\boverflow-x-auto\b[^"]*"/, "wide columns still scroll horizontally");
  assert.ok((pageSource.match(/pageSize:\s*200/g) ?? []).length >= 2, "option and chart requests keep their 200-row limits");
  assert.doesNotMatch(pageSource, /const\s+pageSize\s*=\s*15/);
});

test("dynamic adjustment uses adaptive client slicing without resize requests", async () => {
  const pageSource = getFunctionSource(await readFile(appUrl, "utf8"), "DynamicAdjustmentPage");

  assert.match(pageSource, /useAdaptiveTablePagination\s*\(\s*\)/);
  assert.match(pageSource, /getAdaptivePaginationView\s*\(currentPage,\s*totalItems,\s*pageSize\)/);
  assert.match(
    pageSource,
    /visibleRows\.slice\(\s*\(displayPage\s*-\s*1\)\s*\*\s*pageSize,\s*displayPage\s*\*\s*pageSize,?\s*\)/,
  );
  assert.match(pageSource, /ref=\{tablePageRef\}/);
  assert.match(pageSource, /setCurrentPage\(displayPage\)/, "the owned current page is clamped after client data changes");
  assert.match(pageSource, /disabled=\{!canGoPrevious\}/);
  assert.match(pageSource, /disabled=\{!canGoNext\}/);
  assert.doesNotMatch(pageSource, /const\s+pageSize\s*=\s*15/);
  assert.doesNotMatch(pageSource, /pageSize\s*:/, "client-only adaptive resizing does not alter server requests");
});

test("shared pagination view clamps dynamic-adjustment pages after filtering", () => {
  const view = getAdaptivePaginationView(4, 8, 10);
  assert.equal(view.totalPages, 1);
  assert.equal(view.displayPage, 1);
  assert.equal(view.canGoPrevious, false);
  assert.equal(view.canGoNext, false);
  assert.equal(view.clampPage(99), 1);
});

test("a rejected adaptive request never combines its target page with stale records", () => {
  const existingPage = {
    currentPage: 4,
    records: [{ id: "old-page-record" }],
    totalItems: 73,
    selectedId: "old-page-record",
    loading: false,
    error: "",
  };

  const pending = beginAdaptiveRequest(existingPage, 4);
  assert.deepEqual(pending, {
    currentPage: 4,
    records: [],
    totalItems: 73,
    selectedId: null,
    loading: true,
    error: "",
  });

  const failed = rejectAdaptiveRequest(pending, "request rejected");
  assert.deepEqual(failed, {
    currentPage: 4,
    records: [],
    totalItems: 73,
    selectedId: null,
    loading: false,
    error: "request rejected",
  });
});
