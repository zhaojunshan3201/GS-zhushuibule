import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createElement, StrictMode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useAdaptiveTablePagination } from "../src/shared/adaptiveTablePagination";

const hookPath = new URL("../src/shared/adaptiveTablePagination.ts", import.meta.url);
const source = existsSync(hookPath) ? readFileSync(hookPath, "utf8") : "";
const hookModule = await import("../src/shared/adaptiveTablePagination");
const mapAdaptiveTablePaginationState = (
  hookModule as Record<string, unknown>
).mapAdaptiveTablePaginationState;
const getAdaptivePaginationView = (
  hookModule as Record<string, unknown>
).getAdaptivePaginationView;
const getZonalTablePaginationView = (
  hookModule as Record<string, unknown>
).getZonalTablePaginationView;
const buildPinnedAdaptivePage = (
  hookModule as Record<string, unknown>
).buildPinnedAdaptivePage;

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

test("keeps pending and rejected page controls on one committed boundary", () => {
  assert.equal(typeof getAdaptivePaginationView, "function");
  const getView = getAdaptivePaginationView as (
    currentPage: number,
    totalItems: number,
    pageSize: number,
  ) => {
    totalPages: number;
    displayPage: number;
    canGoPrevious: boolean;
    canGoNext: boolean;
    clampPage: (page: number) => number;
  };

  const committed = { currentPage: 4, totalItems: 73, records: [{ id: "committed" }], loading: false, error: "" };
  const pending = { ...committed, records: [], loading: true };
  const rejected = { ...pending, loading: false, error: "request rejected" };

  for (const requestState of [pending, rejected]) {
    const view = getView(requestState.currentPage, requestState.totalItems, 15);
    assert.equal(view.displayPage <= view.totalPages, true, requestState.error || "pending");
    assert.equal(view.displayPage, 4);
    assert.equal(view.totalPages, 5);
    assert.equal(view.canGoPrevious, true);
    assert.equal(view.canGoNext, true);
    assert.equal(view.clampPage(view.displayPage - 1), 3);
    assert.equal(view.clampPage(view.displayPage + 1), 5);
    assert.equal(view.clampPage(99), 5);
    assert.equal(view.clampPage(0), 1);
  }

  assert.equal(getView(1, 73, 15).canGoPrevious, false);
  assert.equal(getView(5, 73, 15).canGoNext, false);
});

test("zonal pagination distinguishes explicit zero totals from missing demo props", () => {
  assert.equal(typeof getZonalTablePaginationView, "function");
  const getView = getZonalTablePaginationView as (
    currentPage?: number,
    totalItems?: number,
    pageSize?: number,
  ) => {
    totalPages: number;
    displayPage: number;
    displayTotal: number;
    canGoPrevious: boolean;
    canGoNext: boolean;
    clampPage: (page: number) => number;
  };

  const emptySuccess = getView(7, 0, 15);
  assert.equal(emptySuccess.displayTotal, 0);
  assert.equal(emptySuccess.totalPages, 1);
  assert.equal(emptySuccess.displayPage, 1);
  assert.equal(emptySuccess.canGoPrevious, false);
  assert.equal(emptySuccess.canGoNext, false);
  assert.equal(emptySuccess.clampPage(99), 1);

  const pendingOrRejected = getView(4, 73, 15);
  assert.equal(pendingOrRejected.displayTotal, 73);
  assert.equal(pendingOrRejected.totalPages, 5);
  assert.equal(pendingOrRejected.displayPage, 4);
  assert.equal(pendingOrRejected.clampPage(99), 5);

  const demo = getView(undefined, undefined, undefined);
  assert.equal(demo.displayTotal, 568);
  assert.equal(demo.totalPages, 45);
  assert.equal(demo.displayPage, 1);
});

test("builds a pinned page from the records and capacity current when create completes", () => {
  assert.equal(typeof buildPinnedAdaptivePage, "function");
  const buildPage = buildPinnedAdaptivePage as <T extends { id: string }>(
    pinnedRecord: T,
    currentRecords: T[],
    pageSize: number,
  ) => T[];
  const pinnedRecord = { id: "created" };
  const recordsAfterResize = Array.from({ length: 25 }, (_, index) => ({ id: `latest-${index + 1}` }));

  const page = buildPage(pinnedRecord, recordsAfterResize, 25);

  assert.equal(page.length, 25);
  assert.equal(page[0], pinnedRecord);
  assert.deepEqual(page.slice(1).map((record) => record.id), recordsAfterResize.slice(0, 24).map((record) => record.id));
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

test("measures, coalesces resize frames, and cleans up its real lifecycle", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };
  const originalActEnvironment = Object.getOwnPropertyDescriptor(
    actEnvironment,
    "IS_REACT_ACT_ENVIRONMENT",
  );
  let viewportHeight = 650;
  let nextFrameId = 1;
  const listeners = new Set<EventListenerOrEventListenerObject>();
  const addedHandlers: Array<EventListenerOrEventListenerObject> = [];
  const removedHandlers: Array<EventListenerOrEventListenerObject> = [];
  const frames = new Map<number, FrameRequestCallback>();
  const cancelledFrames: number[] = [];
  const fakeWindow = {
    get innerHeight() {
      return viewportHeight;
    },
    addEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      if (type !== "resize") return;
      listeners.add(handler);
      addedHandlers.push(handler);
    },
    removeEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      if (type !== "resize") return;
      listeners.delete(handler);
      removedHandlers.push(handler);
    },
    requestAnimationFrame(callback: FrameRequestCallback) {
      const frameId = nextFrameId++;
      frames.set(frameId, callback);
      return frameId;
    },
    cancelAnimationFrame(frameId: number) {
      cancelledFrames.push(frameId);
      frames.delete(frameId);
    },
  };

  let pagination: ReturnType<typeof useAdaptiveTablePagination> | undefined;
  const renderHistory: Array<ReturnType<typeof useAdaptiveTablePagination>> = [];
  let renderer: ReactTestRenderer | undefined;
  const Harness = () => {
    pagination = useAdaptiveTablePagination({ initialPage: 19 });
    renderHistory.push(pagination);
    return createElement("div", { ref: pagination.tablePageRef });
  };
  const runFrame = (frameId: number) => {
    const callback = frames.get(frameId);
    assert.ok(callback);
    frames.delete(frameId);
    callback(0);
  };

  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    act(() => {
      renderer = create(createElement(StrictMode, null, createElement(Harness)), {
        createNodeMock: () => ({
          getBoundingClientRect: () => ({ top: 80 }),
        }),
      });
    });

    assert.equal(renderHistory[0]?.isMeasured, false);
    assert.equal(pagination?.isMeasured, true);
    assert.equal(pagination?.pageSize, 10);
    assert.equal(pagination?.currentPage, 19);
    assert.equal(listeners.size, 1);

    const activeHandler = [...listeners][0] as EventListener;
    viewportHeight = 900;
    act(() => {
      pagination?.setCurrentPage(2);
      activeHandler(new Event("resize"));
      activeHandler(new Event("resize"));
      assert.equal(frames.size, 1);
      runFrame([...frames.keys()][0]);
    });
    assert.equal(pagination?.pageSize, 15);
    assert.equal(pagination?.currentPage, 1);

    act(() => activeHandler(new Event("resize")));
    const pendingFrame = [...frames.keys()][0];
    assert.ok(pendingFrame);
    act(() => renderer?.unmount());

    assert.equal(removedHandlers.at(-1), activeHandler);
    assert.deepEqual(cancelledFrames, [pendingFrame]);
    assert.equal(listeners.size, 0);
    assert.equal(frames.size, 0);
    assert.ok(addedHandlers.length >= 2);
    assert.equal(removedHandlers.length, addedHandlers.length);
  } finally {
    if (renderer) act(() => renderer?.unmount());
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalActEnvironment) {
      Object.defineProperty(
        actEnvironment,
        "IS_REACT_ACT_ENVIRONMENT",
        originalActEnvironment,
      );
    } else {
      Reflect.deleteProperty(actEnvironment, "IS_REACT_ACT_ENVIRONMENT");
    }
  }
});
