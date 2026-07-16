export type WellHistoryImportName = {
  wellNo: string;
  order: number | null;
};

export type WellHistoryImportPart = {
  sourceOriginalName: string;
  sourceOrder: number;
  partOrder: number | null;
};

export const WELL_HISTORY_BATCH_MAX_FILES = 20;
export const WELL_HISTORY_BATCH_MAX_BYTES = 48 * 1024 * 1024;
export const WELL_HISTORY_MAX_FILE_BYTES = 50 * 1024 * 1024;

export function createWellHistoryImportBatches<T extends { size: number }>(files: T[]) {
  const batches: T[][] = [];
  const oversized: T[] = [];
  let current: T[] = [];
  let currentBytes = 0;

  for (const file of files) {
    if (file.size > WELL_HISTORY_MAX_FILE_BYTES) {
      oversized.push(file);
      continue;
    }

    if (
      current.length > 0
      && (
        current.length >= WELL_HISTORY_BATCH_MAX_FILES
        || currentBytes + file.size > WELL_HISTORY_BATCH_MAX_BYTES
      )
    ) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(file);
    currentBytes += file.size;
  }

  if (current.length > 0) batches.push(current);

  return { batches, oversized };
}

export function normalizeWellHistoryWellNo(value: string) {
  return value.trim().replace(/(\.(?:pptx|ppt|ptx))+$/i, "").trim();
}

export function parseWellHistoryImportFileName(fileName: string): WellHistoryImportName {
  const baseName = normalizeWellHistoryWellNo(fileName);
  const suffixMatch = /^(.*?)(?:[-_\s]+|[（(])(\d+)[）)]?$/.exec(baseName.trim());
  if (!suffixMatch) {
    return { wellNo: baseName, order: null };
  }

  const candidateWellNo = suffixMatch[1].trim().replace(/[（(]\s*$/, "").trim();
  const order = Number(suffixMatch[2]);
  if (!candidateWellNo || !/[-_]\d/.test(candidateWellNo) || !Number.isFinite(order)) {
    return { wellNo: baseName, order: null };
  }

  return { wellNo: candidateWellNo, order };
}

export function sortWellHistoryImportParts<T extends WellHistoryImportPart>(parts: T[]) {
  return [...parts].sort((left, right) => {
    const leftHasOrder = typeof left.partOrder === "number";
    const rightHasOrder = typeof right.partOrder === "number";
    if (leftHasOrder && rightHasOrder && left.partOrder !== right.partOrder) {
      return left.partOrder - right.partOrder;
    }
    if (leftHasOrder !== rightHasOrder) {
      return leftHasOrder ? -1 : 1;
    }
    return left.sourceOrder - right.sourceOrder;
  });
}

export function selectLatestWellHistoryImports<T extends { wellNo: string; sourceOrder: number }>(items: T[]) {
  const latestByWellNo = new Map<string, T>();
  const superseded: T[] = [];

  for (const item of items) {
    const previous = latestByWellNo.get(item.wellNo);
    if (previous) superseded.push(previous);
    latestByWellNo.set(item.wellNo, item);
  }

  const bySourceOrder = (left: T, right: T) => left.sourceOrder - right.sourceOrder;
  return {
    selected: [...latestByWellNo.values()].sort(bySourceOrder),
    superseded: superseded.sort(bySourceOrder),
  };
}

export function getWellHistoryRenameHint(wellNo: string) {
  const normalized = wellNo.trim() || "井号";
  return `同一井号多个PPT请重命名为 ${normalized}-1.pptx、${normalized}-2.pptx 后再导入`;
}
