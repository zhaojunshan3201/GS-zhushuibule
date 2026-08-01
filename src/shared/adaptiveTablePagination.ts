import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { calculateAdaptiveTablePageSize, mapPageForPageSizeChange } from "./secondBatchRecords";
import {
  getBrowserTablePageSizeStorage,
  normalizeTablePageSizeInput,
  readStoredTablePageSize,
  writeStoredTablePageSize,
} from "./tablePageSize";

export type AdaptiveTablePaginationOptions = {
  initialPage?: number;
  fallbackTableTop?: number;
  reservedHeight?: number;
  rowHeight?: number;
  minRows?: number;
  maxRows?: number;
  storageKey?: string;
};

export function mapAdaptiveTablePaginationState(
  currentPage: number,
  pageSize: number,
  nextPageSize: number,
) {
  if (nextPageSize === pageSize) return { currentPage, pageSize };
  return {
    currentPage: mapPageForPageSizeChange(currentPage, pageSize, nextPageSize),
    pageSize: nextPageSize,
  };
}

export function getAdaptivePaginationView(
  currentPage: number,
  totalItems: number,
  pageSize: number,
) {
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 1;
  const safeTotalItems = Number.isFinite(totalItems) && totalItems > 0 ? Math.floor(totalItems) : 0;
  const totalPages = Math.max(1, Math.ceil(safeTotalItems / safePageSize));
  const clampPage = (page: number) => {
    const safePage = Number.isFinite(page) ? Math.floor(page) : 1;
    return Math.min(Math.max(safePage, 1), totalPages);
  };
  const displayPage = clampPage(currentPage);

  return {
    totalPages,
    displayPage,
    canGoPrevious: displayPage > 1,
    canGoNext: displayPage < totalPages,
    clampPage,
  };
}

export function getZonalTablePaginationView(
  currentPage?: number,
  totalItems?: number,
  pageSize?: number,
) {
  const hasExplicitBoundary = totalItems !== undefined && pageSize !== undefined;
  const pagination = hasExplicitBoundary
    ? getAdaptivePaginationView(currentPage ?? 1, totalItems, pageSize)
    : getAdaptivePaginationView(currentPage ?? 1, 45, 1);
  const displayTotal = totalItems === undefined
    ? 568
    : Number.isFinite(totalItems) && totalItems > 0
      ? Math.floor(totalItems)
      : 0;

  return { ...pagination, displayTotal };
}

export function buildPinnedAdaptivePage<T extends { id: string }>(
  pinnedRecord: T,
  currentRecords: T[],
  pageSize: number,
) {
  return [
    pinnedRecord,
    ...currentRecords.filter((record) => record.id !== pinnedRecord.id),
  ].slice(0, pageSize);
}

export function createLatestRequestCoordinator() {
  let latestRequestId = 0;

  return {
    async run<T>(
      request: () => Promise<T>,
      handlers: {
        onStart: () => void;
        onSuccess: (value: T) => void;
        onError: (error: unknown) => void;
        onFinish: () => void;
      },
    ) {
      const requestId = ++latestRequestId;
      handlers.onStart();
      try {
        const value = await request();
        if (requestId !== latestRequestId) return;
        handlers.onSuccess(value);
      } catch (error) {
        if (requestId !== latestRequestId) return;
        handlers.onError(error);
      } finally {
        if (requestId === latestRequestId) handlers.onFinish();
      }
    },
  };
}

export function useAdaptiveTablePagination({
  initialPage = 1,
  fallbackTableTop = 80,
  reservedHeight = 184,
  rowHeight = 41,
  minRows = 10,
  maxRows = 25,
  storageKey,
}: AdaptiveTablePaginationOptions = {}) {
  const tablePageRef = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState(() => ({
    currentPage: initialPage,
    pageSize: storageKey
      ? readStoredTablePageSize(getBrowserTablePageSizeStorage(), storageKey)
      : minRows,
  }));
  const [isMeasured, setIsMeasured] = useState(Boolean(storageKey));
  const currentPageRef = useRef(pagination.currentPage);
  const pageSizeRef = useRef(pagination.pageSize);

  const setCurrentPage = useCallback((nextPage: SetStateAction<number>) => {
    setPagination((current) => {
      const resolvedPage = typeof nextPage === "function"
        ? nextPage(current.currentPage)
        : nextPage;
      if (resolvedPage === current.currentPage) return current;
      return { ...current, currentPage: resolvedPage };
    });
  }, []);

  const setPageSize = useCallback((requestedPageSize: number) => {
    const nextPageSize = normalizeTablePageSizeInput(requestedPageSize);
    if (nextPageSize === null || nextPageSize === pageSizeRef.current) return;

    if (storageKey) {
      writeStoredTablePageSize(
        getBrowserTablePageSizeStorage(),
        storageKey,
        nextPageSize,
      );
    }

    setPagination((current) => {
      return mapAdaptiveTablePaginationState(
        current.currentPage,
        current.pageSize,
        nextPageSize,
      );
    });
  }, [storageKey]);

  useEffect(() => {
    currentPageRef.current = pagination.currentPage;
    pageSizeRef.current = pagination.pageSize;
  }, [pagination]);

  const measurePageSize = useCallback(() => {
    const nextPageSize = calculateAdaptiveTablePageSize({
      viewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
      tableTop: tablePageRef.current?.getBoundingClientRect().top ?? fallbackTableTop,
      reservedHeight,
      rowHeight,
      minRows,
      maxRows,
    });

    setPagination((current) => {
      if (nextPageSize === current.pageSize) return current;
      return mapAdaptiveTablePaginationState(
        current.currentPage,
        current.pageSize,
        nextPageSize,
      );
    });
    setIsMeasured(true);
  }, [fallbackTableTop, maxRows, minRows, reservedHeight, rowHeight]);

  useEffect(() => {
    if (storageKey || typeof window === "undefined") return;

    let animationFrame: number | null = null;
    const handleResize = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        measurePageSize();
      });
    };

    measurePageSize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [measurePageSize, storageKey]);

  const { currentPage, pageSize } = pagination;

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    isMeasured,
    tablePageRef,
    currentPageRef,
    pageSizeRef,
  };
}
