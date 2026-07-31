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

export function useAdaptiveTablePagination({
  initialPage = 1,
  fallbackTableTop = 80,
  reservedHeight = 184,
  rowHeight = 41,
  minRows = 10,
  maxRows = 25,
}: AdaptiveTablePaginationOptions = {}) {
  const tablePageRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPageState] = useState(initialPage);
  const [pageSize, setPageSize] = useState(() => calculateAdaptiveTablePageSize({
    viewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
    tableTop: fallbackTableTop,
    reservedHeight,
    rowHeight,
    minRows,
    maxRows,
  }));
  const currentPageRef = useRef(currentPage);
  const pageSizeRef = useRef(pageSize);

  currentPageRef.current = currentPage;
  pageSizeRef.current = pageSize;

  const setCurrentPage = useCallback((nextPage: SetStateAction<number>) => {
    setCurrentPageState((previousPage) => {
      const resolvedPage = typeof nextPage === "function" ? nextPage(previousPage) : nextPage;
      currentPageRef.current = resolvedPage;
      return resolvedPage;
    });
  }, []);

  const measurePageSize = useCallback(() => {
    const nextPageSize = calculateAdaptiveTablePageSize({
      viewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
      tableTop: tablePageRef.current?.getBoundingClientRect().top ?? fallbackTableTop,
      reservedHeight,
      rowHeight,
      minRows,
      maxRows,
    });

    if (nextPageSize === pageSizeRef.current) return;

    const nextPage = mapPageForPageSizeChange(
      currentPageRef.current,
      pageSizeRef.current,
      nextPageSize,
    );
    pageSizeRef.current = nextPageSize;
    setPageSize(nextPageSize);
    setCurrentPage(nextPage);
  }, [fallbackTableTop, maxRows, minRows, reservedHeight, rowHeight, setCurrentPage]);

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

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    tablePageRef,
    currentPageRef,
    pageSizeRef,
  };
}
