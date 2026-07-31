import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const hookPath = new URL("../src/shared/adaptiveTablePagination.ts", import.meta.url);
const source = existsSync(hookPath) ? readFileSync(hookPath, "utf8") : "";
const hookModule = await import("../src/shared/adaptiveTablePagination");
const mapAdaptiveTablePaginationState = (
  hookModule as Record<string, unknown>
).mapAdaptiveTablePaginationState;

test("exports the shared adaptive table pagination hook and its options", () => {
  assert.match(source, /export type AdaptiveTablePaginationOptions/);
  assert.match(source, /export function useAdaptiveTablePagination/);
  assert.match(source, /initialPage = 1/);
  assert.match(source, /fallbackTableTop = 80/);
  assert.match(source, /reservedHeight = 184/);
  assert.match(source, /rowHeight = 41/);
  assert.match(source, /minRows = 10/);
  assert.match(source, /maxRows = 25/);
});

test("calculates page size and maps the old page's first record", () => {
  assert.match(source, /calculateAdaptiveTablePageSize\s*\(/);
  assert.match(source, /mapPageForPageSizeChange\s*\(/);
  assert.match(source, /getBoundingClientRect\(\)\.top/);
  assert.match(source, /typeof window === "undefined" \? 0 : window\.innerHeight/);
});

test("maps pagination state without relying on React state or refs", () => {
  assert.equal(typeof mapAdaptiveTablePaginationState, "function");
  const mapState = mapAdaptiveTablePaginationState as (
    currentPage: number,
    pageSize: number,
    nextPageSize: number,
  ) => { currentPage: number; pageSize: number };

  assert.deepEqual(mapState(19, 10, 15), { currentPage: 13, pageSize: 15 });
  assert.deepEqual(mapState(7, 15, 15), { currentPage: 7, pageSize: 15 });
});

test("coalesces resize measurement and cleans up browser resources", () => {
  assert.match(source, /addEventListener\("resize"/);
  assert.match(source, /removeEventListener\("resize"/);
  assert.match(source, /requestAnimationFrame\s*\(/);
  assert.match(source, /cancelAnimationFrame\s*\(/);
});

test("keeps page state and refs synchronized", () => {
  assert.match(source, /currentPageRef/);
  assert.match(source, /pageSizeRef/);
  assert.match(source, /SetStateAction<number>/);
  assert.match(source, /tablePageRef/);
  assert.match(source, /setPagination/);
});

test("uses deterministic atomic initial state and only synchronizes refs after commit", () => {
  assert.match(
    source,
    /useState\(\{\s*currentPage: initialPage,\s*pageSize: minRows,?\s*\}\)/,
  );
  assert.doesNotMatch(source, /useState\(\(\) => calculateAdaptiveTablePageSize/);
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*currentPageRef\.current = pagination\.currentPage;\s*pageSizeRef\.current = pagination\.pageSize;\s*\}, \[pagination\]\)/,
  );
  assert.equal(source.match(/(?:currentPageRef|pageSizeRef)\.current\s*=/g)?.length, 2);
});
