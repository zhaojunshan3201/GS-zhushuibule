export const DEFAULT_TABLE_PAGE_SIZE = 25;
export const MIN_TABLE_PAGE_SIZE = 5;
export const MAX_TABLE_PAGE_SIZE = 100;

export type TablePageSizeStorage = Pick<Storage, "getItem" | "setItem">;

export function getBrowserTablePageSizeStorage(): TablePageSizeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeTablePageSizeInput(
  value: string | number,
): number | null {
  const parsed = typeof value === "number"
    ? value
    : /^[+-]?\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;

  if (!Number.isSafeInteger(parsed)) return null;
  return Math.min(Math.max(parsed, MIN_TABLE_PAGE_SIZE), MAX_TABLE_PAGE_SIZE);
}

export function readStoredTablePageSize(
  storage: TablePageSizeStorage | null,
  storageKey: string,
  fallback = DEFAULT_TABLE_PAGE_SIZE,
): number {
  if (!storage) return fallback;

  try {
    const value = storage.getItem(storageKey);
    if (value === null || !/^\d+$/.test(value)) return fallback;
    const pageSize = Number(value);
    return Number.isSafeInteger(pageSize)
      && pageSize >= MIN_TABLE_PAGE_SIZE
      && pageSize <= MAX_TABLE_PAGE_SIZE
      ? pageSize
      : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredTablePageSize(
  storage: TablePageSizeStorage | null,
  storageKey: string,
  pageSize: number,
): boolean {
  if (!storage) return false;

  try {
    storage.setItem(storageKey, String(pageSize));
    return true;
  } catch {
    return false;
  }
}
