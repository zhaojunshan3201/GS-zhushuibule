import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  getBrowserTablePageSizeStorage,
  MAX_TABLE_PAGE_SIZE,
  MIN_TABLE_PAGE_SIZE,
  normalizeTablePageSizeInput,
  readStoredTablePageSize,
  writeStoredTablePageSize,
} from "../src/shared/tablePageSize";

test("declares the table page size bounds and default", () => {
  assert.equal(DEFAULT_TABLE_PAGE_SIZE, 25);
  assert.equal(MIN_TABLE_PAGE_SIZE, 5);
  assert.equal(MAX_TABLE_PAGE_SIZE, 100);
});

test("normalizes signed integer submissions and clamps them to the fixed bounds", () => {
  assert.equal(normalizeTablePageSizeInput("25"), 25);
  assert.equal(normalizeTablePageSizeInput(5), 5);
  assert.equal(normalizeTablePageSizeInput("1"), 5);
  assert.equal(normalizeTablePageSizeInput("-1"), 5);
  assert.equal(normalizeTablePageSizeInput("+12"), 12);
  assert.equal(normalizeTablePageSizeInput(101), 100);
});

test("rejects invalid submitted page size values", () => {
  for (const value of ["", " ", "1.5", "1e2", "twenty", Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(normalizeTablePageSizeInput(value), null, String(value));
  }
});

test("reads and writes independent stored page size keys while rejecting invalid stored values", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  assert.equal(writeStoredTablePageSize(storage, "first", 15), true);
  assert.equal(writeStoredTablePageSize(storage, "second", 30), true);
  assert.equal(readStoredTablePageSize(storage, "first"), 15);
  assert.equal(readStoredTablePageSize(storage, "second"), 30);

  for (const value of ["", " 25", "25 ", "1.5", "1e2", "4", "101", "9999999999999999"]) {
    values.set("invalid", value);
    assert.equal(readStoredTablePageSize(storage, "invalid"), DEFAULT_TABLE_PAGE_SIZE, value);
  }
  assert.equal(readStoredTablePageSize(storage, "missing", 17), 17);
});

test("handles unavailable, throwing, and browser-blocked storage safely", () => {
  const throwingStorage = {
    getItem: () => { throw new DOMException("Blocked", "SecurityError"); },
    setItem: () => { throw new DOMException("Blocked", "SecurityError"); },
  };
  assert.equal(readStoredTablePageSize(null, "size"), DEFAULT_TABLE_PAGE_SIZE);
  assert.equal(writeStoredTablePageSize(null, "size", 25), false);
  assert.equal(readStoredTablePageSize(throwingStorage, "size"), DEFAULT_TABLE_PAGE_SIZE);
  assert.equal(writeStoredTablePageSize(throwingStorage, "size", 25), false);

  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    get: () => ({
      get localStorage() {
        throw new DOMException("Blocked", "SecurityError");
      },
    }),
  });
  try {
    assert.equal(getBrowserTablePageSizeStorage(), null);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
