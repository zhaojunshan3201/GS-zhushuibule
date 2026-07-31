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
