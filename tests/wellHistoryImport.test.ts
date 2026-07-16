import assert from "node:assert/strict";
import test from "node:test";
import {
  createWellHistoryImportBatches,
  getWellHistoryRenameHint,
  parseWellHistoryImportFileName,
  selectLatestWellHistoryImports,
  sortWellHistoryImportParts,
  WELL_HISTORY_BATCH_MAX_BYTES,
  WELL_HISTORY_BATCH_MAX_FILES,
  WELL_HISTORY_MAX_FILE_BYTES,
} from "../src/shared/wellHistoryImport";

const MB = 1024 * 1024;

test("createWellHistoryImportBatches starts a new batch after 20 files", () => {
  const files = Array.from({ length: 21 }, (_, index) => ({ index, size: 1 }));

  const result = createWellHistoryImportBatches(files);

  assert.equal(WELL_HISTORY_BATCH_MAX_FILES, 20);
  assert.deepEqual(result.batches.map((batch) => batch.length), [20, 1]);
  assert.deepEqual(result.batches.flat(), files);
  assert.deepEqual(result.oversized, []);
});

test("createWellHistoryImportBatches starts a new batch before exceeding 48 MB", () => {
  const files = [
    { name: "first", size: 48 * MB - 10 },
    { name: "second", size: 20 },
  ];

  const result = createWellHistoryImportBatches(files);

  assert.equal(WELL_HISTORY_BATCH_MAX_BYTES, 48 * MB);
  assert.deepEqual(result.batches, [[files[0]], [files[1]]]);
  assert.deepEqual(result.oversized, []);
});

test("createWellHistoryImportBatches keeps files totaling exactly 48 MB together", () => {
  const files = [
    { name: "first", size: 24 * MB },
    { name: "second", size: 24 * MB },
  ];

  const result = createWellHistoryImportBatches(files);

  assert.deepEqual(result.batches, [files]);
  assert.deepEqual(result.oversized, []);
});

test("createWellHistoryImportBatches accepts a file exactly at the 48 MB batch limit", () => {
  const file = { name: "at-limit", size: WELL_HISTORY_BATCH_MAX_BYTES };

  const result = createWellHistoryImportBatches([file]);

  assert.deepEqual(result.batches, [[file]]);
  assert.deepEqual(result.oversized, []);
});

test("createWellHistoryImportBatches rejects a file one byte above the 48 MB batch limit", () => {
  const file = { name: "oversized", size: WELL_HISTORY_BATCH_MAX_BYTES + 1 };

  const result = createWellHistoryImportBatches([file]);

  assert.equal(WELL_HISTORY_MAX_FILE_BYTES, 50 * MB);
  assert.deepEqual(result.batches, []);
  assert.deepEqual(result.oversized, [file]);
});

test("createWellHistoryImportBatches preserves eligible order around an oversized file", () => {
  const first = { name: "first", size: 1 };
  const oversized = { name: "oversized", size: WELL_HISTORY_BATCH_MAX_BYTES + 1 };
  const second = { name: "second", size: 1 };

  const result = createWellHistoryImportBatches([first, oversized, second]);

  assert.deepEqual(result.batches, [[first, second]]);
  assert.deepEqual(result.oversized, [oversized]);
});

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

test("selectLatestWellHistoryImports keeps invalid names distinct from each other and legal names", () => {
  const firstInvalid = { wellNo: "", sourceOrder: 0, fileName: "first.pptx" };
  const legalOldSentinel = { wellNo: "__invalid_0", sourceOrder: 1, fileName: "legal.pptx" };
  const secondInvalid = { wellNo: "", sourceOrder: 2, fileName: "second.pptx" };

  const result = selectLatestWellHistoryImports([firstInvalid, legalOldSentinel, secondInvalid]);

  assert.deepEqual(result.selected, [firstInvalid, legalOldSentinel, secondInvalid]);
  assert.deepEqual(result.superseded, []);
  assert.equal(result.selected[0].wellNo, "");
  assert.equal(result.selected[2].wellNo, "");
});
