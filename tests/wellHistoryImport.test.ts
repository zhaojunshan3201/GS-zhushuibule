import assert from "node:assert/strict";
import test from "node:test";
import {
  getWellHistoryRenameHint,
  parseWellHistoryImportFileName,
  selectLatestWellHistoryImports,
  sortWellHistoryImportParts,
} from "../src/shared/wellHistoryImport";

test("parseWellHistoryImportFileName groups numbered files under the same well number", () => {
  assert.deepEqual(parseWellHistoryImportFileName("GS-101-1.pptx"), {
    wellNo: "GS-101",
    order: 1,
  });
  assert.deepEqual(parseWellHistoryImportFileName("GS-101_2.ppt"), {
    wellNo: "GS-101",
    order: 2,
  });
  assert.deepEqual(parseWellHistoryImportFileName("GS-101（3）.pptx"), {
    wellNo: "GS-101",
    order: 3,
  });
});

test("parseWellHistoryImportFileName keeps the full well number when there is no page suffix", () => {
  assert.deepEqual(parseWellHistoryImportFileName("GS-101.pptx"), {
    wellNo: "GS-101",
    order: null,
  });
  assert.deepEqual(parseWellHistoryImportFileName("雷19-10.pptx"), {
    wellNo: "雷19-10",
    order: null,
  });
});

test("sortWellHistoryImportParts sorts numeric suffixes before upload order fallback", () => {
  const sorted = sortWellHistoryImportParts([
    { sourceOriginalName: "GS-101-2.pptx", sourceOrder: 0, partOrder: 2 },
    { sourceOriginalName: "GS-101-1.pptx", sourceOrder: 1, partOrder: 1 },
    { sourceOriginalName: "GS-101-A.pptx", sourceOrder: 2, partOrder: null },
  ]);

  assert.deepEqual(sorted.map((item) => item.sourceOriginalName), [
    "GS-101-1.pptx",
    "GS-101-2.pptx",
    "GS-101-A.pptx",
  ]);
});

test("getWellHistoryRenameHint asks for numbered names when a merged group lacks suffixes", () => {
  assert.equal(
    getWellHistoryRenameHint("GS-101"),
    "同一井号多个PPT请重命名为 GS-101-1.pptx、GS-101-2.pptx 后再导入",
  );
});

test("selectLatestWellHistoryImports keeps only the last upload for each well", () => {
  const oldFile = { wellNo: "37-29", sourceOrder: 0, fileName: "37-29 old.pptx" };
  const otherWell = { wellNo: "37-31", sourceOrder: 1, fileName: "37-31.pptx" };
  const newFile = { wellNo: "37-29", sourceOrder: 2, fileName: "37-29 new.pptx" };

  const result = selectLatestWellHistoryImports([oldFile, otherWell, newFile]);

  assert.deepEqual(result.selected, [otherWell, newFile]);
  assert.deepEqual(result.superseded, [oldFile]);
});
