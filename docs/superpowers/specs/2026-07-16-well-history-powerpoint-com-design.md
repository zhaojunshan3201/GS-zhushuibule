# 单井井史 PPT 批量导入：PowerPoint COM PNG 导出

## 目标

将单井井史的 PPT/PPTX 批量导入图片生成流程改为 Windows Microsoft PowerPoint 桌面版 COM 自动化：打开演示文稿、逐页导出 PNG，并将 PNG 按页插入井史富文本。

## 范围

- 支持 `.ppt` 和 `.pptx` 的 PowerPoint COM 打开及逐页 PNG 导出。
- `.ppt` 使用同一 COM 实例另存为 `.pptx`，维持现有 PPTX 存档和编辑器模型。
- 保留现有 PNG 存储位置、页码顺序、富文本 HTML 结构和批量导入 API。
- 移除该导入路径对 LibreOffice 转 PDF 和 Python/PyMuPDF 转 PNG 的调用。

## 非范围

- 不修改前端批量选择、井号分组或富文本展示方式。
- 不支持同一井号多个 PPT 文件的合并。
- 不变更 PDF 井史上传流程。

## 设计

### COM 自动化

服务端通过 `powershell.exe` 执行脚本，创建 `PowerPoint.Application`，后台打开输入文件。对每个 `Slide` 调用 `Export(outputPath, "PNG")`，文件名固定为 `page-<页码>.png`。脚本在 `finally` 中关闭演示文稿和 PowerPoint 实例，并释放 COM 资源。

对 `.ppt`，使用打开的演示文稿 `SaveAs(..., 24)` 转存为 PPTX；`.pptx` 直接作为解析、存档和导出输入。这样 PPTX 编辑器的现有解析与存储逻辑保持不变。

### 导入数据流

1. 保存上传的原始 PPT/PPTX 到临时源目录。
2. 调用 PowerPoint COM：若源文件是 PPT 则生成 PPTX，且逐页导出 PNG。
3. 解析 PPTX、按数字页码排序导出的 PNG，并将 PNG 移入井史上传目录。
4. 用现有 `buildPptSlideHtml(pageUrls)` 生成富文本，按页插入图片。
5. 使用现有持久化逻辑保存 PPTX 记录和富文本文档。

### 错误处理

COM 不可用、PowerPoint 打开失败、导出失败或未生成 PNG 时，单个文件返回导入失败；其他文件继续处理。错误文本应指向 Microsoft PowerPoint COM，而非 LibreOffice。

## 测试与验证

- 单元测试验证 PowerShell COM 调用参数、PPT 转存目标、PNG 文件的数字排序，以及没有页面时的失败。
- 执行 `npm test`、`npm run lint` 与 `npm run build`。
- 在安装 Microsoft PowerPoint 的 Windows 环境使用一个多页 PPT/PPTX 验证逐页 PNG 和富文本图片顺序。
