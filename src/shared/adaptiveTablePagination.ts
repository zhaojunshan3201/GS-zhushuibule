import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { calculateAdaptiveTablePageSize, mapPageForPageSizeChange } from "./secondBatchRecords";

export type AdaptiveTablePaginationOptions = {
  initialPage?: number;
  fallbackTableTop?: number;
  reservedHeight?: number;
  rowHeight?: number;
  minRows?: number;
  maxRows?: number;
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

export function useAdaptiveTablePagination({
  initialPage = 1,
  fallbackTableTop = 80,
  reservedHeight = 184,
  rowHeight = 41,
  minRows = 10,
  maxRows = 25,
}: AdaptiveTablePaginationOptions = {}) {
  const tablePageRef = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState({
    currentPage: initialPage,
    pageSize: minRows,
  });
  const [isMeasured, setIsMeasured] = useState(false);
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
    if (typeof window === "undefined") return;

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
  }, [measurePageSize]);

  const { currentPage, pageSize } = pagination;

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    isMeasured,
    tablePageRef,
    currentPageRef,
    pageSizeRef,
  };
}
