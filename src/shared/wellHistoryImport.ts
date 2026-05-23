export type WellHistoryImportName = {
  wellNo: string;
  order: number | null;
};

export type WellHistoryImportPart = {
  sourceOriginalName: string;
  sourceOrder: number;
  partOrder: number | null;
};

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

export function getWellHistoryRenameHint(wellNo: string) {
  const normalized = wellNo.trim() || "井号";
  return `同一井号多个PPT请重命名为 ${normalized}-1.pptx、${normalized}-2.pptx 后再导入`;
}
