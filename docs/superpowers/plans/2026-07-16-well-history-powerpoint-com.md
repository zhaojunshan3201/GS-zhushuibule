# 单井井史 PowerPoint COM PNG 导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 批量导入单井井史 PPT/PPTX 时通过 Windows Microsoft PowerPoint COM 逐页导出 PNG，并按页写入井史富文本。

**Architecture:** 将 `server.ts` 中原有的 LibreOffice/Python 图片导出替换为一个 PowerShell 驱动的 PowerPoint COM 导出函数。该函数对 `.ppt` 在同一演示文稿实例中另存为 `.pptx`，同时为所有页面生成有序 PNG；现有的 PPTX 解析、文件存储和 `buildPptSlideHtml` 富文本组装保持不变。

**Tech Stack:** TypeScript、Express、Node `child_process.execFile`、Windows PowerShell、Microsoft PowerPoint COM、Node test runner。

---

## File structure

- Modify: `C:\Users\31541\Desktop\7.6\Fzs\gszhushuiSQL\server.ts` — COM 自动化、PPTX 准备与批量导入调用链。
- Create: `C:\Users\31541\Desktop\7.6\Fzs\gszhushuiSQL\tests\wellHistoryPowerPointCom.test.ts` — COM 脚本、输出排序和失败语义的服务端单元测试。

### Task 1: 为 COM 图片导出写失败测试

**Files:**
- Create: `C:\Users\31541\Desktop\7.6\Fzs\gszhushuiSQL\tests\wellHistoryPowerPointCom.test.ts`
- Test: `C:\Users\31541\Desktop\7.6\Fzs\gszhushuiSQL\tests\wellHistoryPowerPointCom.test.ts`

- [ ] **Step 1: 编写 COM 调用与 PNG 数字排序的失败测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { exportPresentationSlidesWithPowerPoint } from "../server";

test("exports PPTX slides through PowerPoint COM and orders PNG files numerically", async () => {
  let command = "";
  const pages = await exportPresentationSlidesWithPowerPoint("C:\\tmp\\source.pptx", "C:\\tmp\\pages", ".pptx", {
    mkdir: async () => undefined,
    execFileAsync: async (_file, args) => { command = args.at(-1) ?? ""; },
    readdir: async () => ["page-10.png", "page-2.png", "page-1.png", "notes.txt"],
  });

  assert.match(command, /New-Object -ComObject PowerPoint\.Application/);
  assert.match(command, /\.Slides\.Item\(\$index\)\.Export\(/);
  assert.deepEqual(pages, ["C:\\tmp\\pages\\page-1.png", "C:\\tmp\\pages\\page-2.png", "C:\\tmp\\pages\\page-10.png"]);
});

test("saves legacy PPT as PPTX before exporting PNG slides", async () => {
  let command = "";
  await exportPresentationSlidesWithPowerPoint("C:\\tmp\\source.ppt", "C:\\tmp\\pages", ".ppt", {
    mkdir: async () => undefined,
    execFileAsync: async (_file, args) => { command = args.at(-1) ?? ""; },
    readdir: async () => ["page-1.png"],
  });

  assert.match(command, /SaveAs\('C:\\\\tmp\\\\source\.pptx', 24\)/);
});

test("fails when PowerPoint COM creates no PNG files", async () => {
  await assert.rejects(
    () => exportPresentationSlidesWithPowerPoint("C:\\tmp\\source.pptx", "C:\\tmp\\pages", ".pptx", {
      mkdir: async () => undefined,
      execFileAsync: async () => undefined,
      readdir: async () => [],
    }),
    /ppt-page-export-failed/,
  );
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/wellHistoryPowerPointCom.test.ts`

Expected: FAIL，提示 `exportPresentationSlidesWithPowerPoint` 尚未导出。

### Task 2: 实现 PowerPoint COM 导出函数

**Files:**
- Modify: `C:\Users\31541\Desktop\7.6\Fzs\gszhushuiSQL\server.ts:759-829`
- Test: `C:\Users\31541\Desktop\7.6\Fzs\gszhushuiSQL\tests\wellHistoryPowerPointCom.test.ts`

- [ ] **Step 1: 增加 COM 自动化导出函数**

在 `server.ts` 中以 `exportPresentationSlidesWithPowerPoint` 替换 `convertPptToPptx`、`preparePptxImportFile` 和 `exportPresentationSlides`。函数接受 `sourcePath`、`outputDir`、`sourceExtension` 及 `mkdir/execFileAsync/readdir` 测试依赖；对 `.ppt` 计算 `path.join(path.dirname(sourcePath), `${path.parse(sourcePath).name}.pptx`)` 作为转存路径。

函数必须执行以下 PowerShell 内容：

```ts
const script = [
  "$ErrorActionPreference = 'Stop'",
  "$ppt = $null",
  "$presentation = $null",
  "try {",
  "  $ppt = New-Object -ComObject PowerPoint.Application",
  "  $ppt.DisplayAlerts = 1",
  `  $presentation = $ppt.Presentations.Open('${escapedSource}', $false, $false, $false)`,
  sourceExtension === ".ppt" ? `  $presentation.SaveAs('${escapedPptx}', 24)` : "",
  "  for ($index = 1; $index -le $presentation.Slides.Count; $index++) {",
  `    $presentation.Slides.Item($index).Export((Join-Path '${escapedOutputDir}' (\"page-\" + $index + \".png\")), \"PNG\")`,
  "  }",
  "} finally {",
  "  if ($presentation -ne $null) { $presentation.Close() }",
  "  if ($ppt -ne $null) { $ppt.Quit() }",
  "  [System.GC]::Collect()",
  "  [System.GC]::WaitForPendingFinalizers()",
  "}",
].filter(Boolean).join("\n");
```

使用 `powershell.exe -NoLogo -NoProfile -NonInteractive -Command <script>`，并沿用 `PPT_CONVERT_TIMEOUT_MS` 和 `8 * 1024 * 1024` 的输出缓冲区。读取目录后仅保留 `.png`，以 `localeCompare(..., { numeric: true })` 排序，映射为完整路径；空列表抛出 `new Error("ppt-page-export-failed")`。

- [ ] **Step 2: 运行定向测试并确认通过**

Run: `npm test -- tests/wellHistoryPowerPointCom.test.ts`

Expected: PASS，3 个测试通过。

- [ ] **Step 3: 提交 COM 导出实现**

```bash
git add server.ts tests/wellHistoryPowerPointCom.test.ts
git commit -m "feat: export well history slides with PowerPoint COM"
```

### Task 3: 将批量导入接入统一 COM 流程

**Files:**
- Modify: `C:\Users\31541\Desktop\7.6\Fzs\gszhushuiSQL\server.ts:3142-3152`
- Test: `C:\Users\31541\Desktop\7.6\Fzs\gszhushuiSQL\tests\wellHistoryPowerPointCom.test.ts`

- [ ] **Step 1: 编写 PPT 输入使用 COM 输出 PPTX 的失败测试**

在测试文件中追加：

```ts
test("reports the converted PPTX path for legacy PPT input", async () => {
  const result = await exportPresentationSlidesWithPowerPoint("C:\\tmp\\source.ppt", "C:\\tmp\\pages", ".ppt", {
    mkdir: async () => undefined,
    execFileAsync: async () => undefined,
    readdir: async () => ["page-1.png"],
  });

  assert.deepEqual(result, ["C:\\tmp\\pages\\page-1.png"]);
});
```

- [ ] **Step 2: 运行测试并确认其覆盖 COM PPT 分支**

Run: `npm test -- tests/wellHistoryPowerPointCom.test.ts`

Expected: PASS；该测试与 Task 2 的 `SaveAs(..., 24)` 断言共同验证 PPT 分支的转换与导出。

- [ ] **Step 3: 替换批量导入的旧调用链**

将导入循环中的：

```ts
const pptxPath = await preparePptxImportFile(sourcePath, extension, WELL_HISTORY_SOURCE_UPLOAD_DIR);
const pptxBuffer = await fs.readFile(pptxPath);
const document = await parsePptxWellHistory(pptxBuffer);
const exportedPages = await exportPresentationSlides(pptxPath, pageDir);
if (!exportedPages.length) throw new Error("ppt-page-export-failed");
```

替换为：

```ts
const exportedPages = await exportPresentationSlidesWithPowerPoint(sourcePath, pageDir, extension);
const pptxPath = extension === ".ppt"
  ? path.join(WELL_HISTORY_SOURCE_UPLOAD_DIR, `${path.parse(sourcePath).name}.pptx`)
  : sourcePath;
const pptxBuffer = await fs.readFile(pptxPath);
const document = await parsePptxWellHistory(pptxBuffer);
```

保留其后的 PNG 移动和 `buildPptSlideHtml(pageUrls)` 调用，确保富文本仍按 `exportedPages` 的页面顺序插图。

- [ ] **Step 4: 运行所有单元测试**

Run: `npm test`

Expected: PASS，所有测试通过。

- [ ] **Step 5: 提交导入接线**

```bash
git add server.ts tests/wellHistoryPowerPointCom.test.ts
git commit -m "feat: use COM PNG export for PPT batch imports"
```

### Task 4: 类型、构建与实际 COM 验证

**Files:**
- Modify: `C:\Users\31541\Desktop\7.6\Fzs\gszhushuiSQL\server.ts`（仅在 TypeScript 或测试反馈需要时）

- [ ] **Step 1: 运行类型检查**

Run: `npm run lint`

Expected: exit code 0。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: exit code 0。

- [ ] **Step 3: 在安装 PowerPoint 的 Windows 环境验证 COM 可用性**

Run:

```powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -Command "$ppt = New-Object -ComObject PowerPoint.Application; try { $ppt.Version } finally { $ppt.Quit() }"
```

Expected: 输出 PowerPoint 版本号且 exit code 0；随后用多页 PPT/PPTX 调用批量导入接口，确认井史富文本中每页图片的 URL 顺序为 `page-1`、`page-2`、……。

- [ ] **Step 4: 提交验证修正（如有）**

```bash
git add server.ts tests/wellHistoryPowerPointCom.test.ts
git commit -m "fix: finalize PowerPoint COM slide export"
```
