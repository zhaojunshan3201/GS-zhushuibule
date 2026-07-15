import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
const { exportPresentationSlidesWithPowerPoint, validatePptxUploadFileName } = await import("../server");

test("exports PPTX slides with PowerPoint COM and returns naturally sorted PNG paths", async () => {
  let command = "";
  const pages = await exportPresentationSlidesWithPowerPoint("C:\\tmp\\source.pptx", "C:\\tmp\\pages", ".pptx", {
    mkdir: async () => undefined,
    execFileAsync: async (_file, args) => { command = args[args.length - 1]; },
    readdir: async () => ["page-10.png", "page-2.png", "page-1.png", "notes.txt"],
  });

  assert.match(command, /New-Object -ComObject PowerPoint\.Application/);
  assert.match(command, /\.Slides\.Item\(\$index\)\.Export\(/);
  assert.match(command, /finally \{\n  try \{\n    if \(\$presentation -ne \$null\) \{ \$presentation\.Close\(\) \}\n  \} finally \{\n    try \{\n      if \(\$ppt -ne \$null\) \{ \$ppt\.Quit\(\) \}/);
  assert.deepEqual(pages, [
    "C:\\tmp\\pages\\page-1.png",
    "C:\\tmp\\pages\\page-2.png",
    "C:\\tmp\\pages\\page-10.png",
  ]);
});

test("converts PPT to PPTX in the same PowerPoint COM session", async () => {
  let command = "";
  await exportPresentationSlidesWithPowerPoint("C:\\tmp\\source.ppt", "C:\\tmp\\pages", ".ppt", {
    mkdir: async () => undefined,
    execFileAsync: async (_file, args) => { command = args[args.length - 1]; },
    readdir: async () => ["page-1.png"],
  });

  assert.match(command, /SaveAs\('C:\\tmp\\source\.pptx', 24\)/);
});

test("fails when PowerPoint did not export any PNG pages", async () => {
  await assert.rejects(
    () => exportPresentationSlidesWithPowerPoint("C:\\tmp\\source.pptx", "C:\\tmp\\pages", ".pptx", {
      mkdir: async () => undefined,
      execFileAsync: async () => undefined,
      readdir: async () => [],
    }),
    /ppt-page-export-failed/,
  );
});

test("kills the marked PowerPoint process and removes its marker when COM export times out", async () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const removed: string[] = [];
  const timeout = new Error("ETIMEDOUT");

  await assert.rejects(
    () => exportPresentationSlidesWithPowerPoint("C:\\tmp\\source.pptx", "C:\\tmp\\pages", ".pptx", {
      mkdir: async () => undefined,
      execFileAsync: async (file, args) => {
        calls.push({ file, args });
        if (file === "powershell.exe") throw timeout;
      },
      readFile: async () => Buffer.from("1234\n"),
      unlink: async (markerPath) => { removed.push(markerPath); },
      readdir: async () => [],
    }),
    (error) => error === timeout,
  );

  assert.deepEqual(calls.at(-1), { file: "taskkill.exe", args: ["/PID", "1234", "/T", "/F"] });
  assert.deepEqual(removed, ["C:\\tmp\\pages\\.powerpoint-pid"]);
});

test("accepts PPT uploads now that PowerPoint performs the conversion", () => {
  assert.deepEqual(validatePptxUploadFileName("source.ppt"), { ok: true });
});
