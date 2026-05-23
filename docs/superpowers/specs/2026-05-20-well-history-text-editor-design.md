# 单井井史"文本编辑"功能改造 — 设计规格

**日期**: 2026-05-20
**状态**: 已确认

## 概述

改造单井井史页面的"文本编辑"功能，从现有的简单文本叠加（input 输入框）升级为富文本模态编辑器 + 可拖放便签卡片模式。便签作为井史补充说明，支持拖放整理，切换时提示未保存，最终可融合到 PDF。

## 设计决策

| 决策点 | 选择 |
|--------|------|
| 交互模式 | 模态编辑器 + 可拖拽便签卡片 |
| 编辑器类型 | 富文本（加粗、斜体、标题、列表） |
| 便签放置 | 逐页绑定 PDF 页面 |
| 保存方式 | 手动保存 + 离开提示对话框 |
| 最终输出 | 与目标 PDF 页面融合 |
| 技术方案 | 浏览器 contentEditable，无额外 npm 依赖 |

## 数据模型

扩展现有 `WellHistoryPdfOverlay.elementsJson`，新增 `sticky` 元素类型。无需新建数据库表。

```typescript
// 新增类型（追加到 src/App.tsx PdfOverlayElement 联合类型）
interface PdfStickyNoteElement {
  type: "sticky";
  id: string;           // uuid
  pageIndex: number;    // PDF 页码（从0开始）
  x: number;            // 归一化坐标 (0-1)
  y: number;            // 归一化坐标 (0-1)
  width: number;        // 归一化宽度 (0-1)
  height: number;       // 归一化高度 (0-1)
  title: string;        // 便签标题
  content: string;      // 富文本 HTML
  color: "yellow" | "blue" | "green" | "pink";
  createdAt: string;    // ISO 时间戳
  updatedAt: string;    // ISO 时间戳
}
```

## 组件变更

### 新增组件

**RichTextEditorModal**
- 模态覆盖层，点击"文本编辑"按钮打开
- 标题输入框
- 富文本工具栏：B / I / U / H1 / H2 / 无序列表 / 有序列表
- 便签颜色选择器（黄/蓝/绿/粉）
- 操作按钮：取消 / 保存并放置
- 编辑已有便签时预填数据，保存时原地更新
- 基于浏览器 `contentEditable`，`document.execCommand` 控制格式

**StickyNoteCard**（在 PDF 页面上渲染）
- 彩色标题栏（显示 title + 编辑/删除图标按钮）
- 内容区（渲染 content HTML，超出部分裁剪）
- 鼠标拖放重新定位（复用现有 draggingText 机制）
- 点击编辑图标 → 打开 RichTextEditorModal（编辑模式）
- 点击删除图标 → 删除确认后从 overlayElements 移除

### 修改组件

**WellHistoryPdfEditor**
- 工具栏新增"文本编辑"按钮（区分于现有"文本"叠加工具）
- SVG 叠加层中渲染 sticky 类型元素
- 扩展现有拖放事件处理，支持 sticky 元素
- 扩展现有 `downloadAnnotatedPdf()`，渲染 sticky 内容到 PDF

**WellHistoryPage**
- 添加脏状态跟踪（dirty: boolean）
- 切换井号时检查脏状态，弹出确认对话框
- 切换页面（翻页）时仅跟踪脏状态，不触发确认
- 保存成功后清除脏标记

## API

无需新增后端端点。现有接口直接兼容：

| 方法 | 端点 | 用途 |
|------|------|------|
| GET | `/api/well-history-archives/:wellNo/pdf-overlay` | 加载便签 + 现有叠加层 |
| POST | `/api/well-history-archives/:wellNo/pdf-overlay` | 保存便签 + 现有叠加层 |
| GET | `/api/well-history-archives/:wellNo/pdf-content` | 获取 PDF 二进制（融合用） |

## 交互工作流

### 新建便签
1. 用户在 PDF 某页点击工具栏"文本编辑"
2. RichTextEditorModal 打开，默认空白，当前页码显示在标题栏
3. 输入标题（可选）和内容，使用工具栏格式化
4. 选择颜色（默认黄色）
5. 点击"保存并放置" → 模态关闭，便签出现在当前页默认位置
6. 便签置入 overlayElements（本地状态），dirty = true

### 编辑便签
1. 点击便签卡片上的编辑图标
2. RichTextEditorModal 打开，预填现有标题/内容/颜色
3. 修改后点击"保存并放置" → 模态关闭，便签内容原地更新，dirty = true

### 拖放便签
1. 鼠标按下便签标题栏开始拖放
2. 移动鼠标调整位置
3. 释放鼠标 → 便签新位置更新，dirty = true

### 删除便签
1. 点击便签卡片上的删除图标
2. 简单确认（或直接删除）
3. 便签从 overlayElements 移除，dirty = true

### 保存
1. 点击工具栏"保存"按钮
2. 调用 POST overlay API，提交完整的 overlayElements 数组
3. 保存成功 → dirty = false，显示成功提示

### 离开确认
1. 用户切换井号（在 WellHistoryPage 搜索新井）
2. 检查 dirty 状态
3. 如果 dirty = true → 弹出确认对话框
   - "保存并切换" → 先保存再加载新井
   - "不保存，直接切换" → 丢弃更改，加载新井
   - "取消" → 留在当前页

### 融合 PDF
1. 用户点击"融合PDF"按钮
2. 调用现有 `downloadAnnotatedPdf()` 逻辑
3. sticky 类型元素被渲染为带边框和标题的文本块到 PDF 页面上
4. 浏览器下载带便签内容的融合 PDF

## 无外部依赖

富文本编辑完全基于浏览器内置能力：
- `contentEditable` 属性使编辑区域可编辑
- `document.execCommand('bold')` 等命令控制格式
- 不使用 Quill、TipTap、Slate 等第三方库

## 文件变更范围

| 文件 | 变更类型 |
|------|----------|
| `src/App.tsx` | 主要变更：新增 RichTextEditorModal、StickyNoteCard，扩展 WellHistoryPdfEditor、WellHistoryPage |
| `server.ts` | 无需变更 |
| `prisma/schema.prisma` | 无需变更 |
