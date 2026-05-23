# 单井井史 PDF 轻量编辑层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `单井井史` 页面增加 PDF 轻量编辑工具条，支持放大、缩小、自适应、矩形标注、箭头标注、文本编辑，并支持页内保存与下载导出。

**Architecture:** 保持原 PDF 作为底稿不变，在前端每页 PDF 画布上方叠加一层可编辑覆盖层。后端新增编辑层读写与导出接口，保存时只落编辑层 JSON，下载时再将底稿与编辑层合成结果文件。

**Tech Stack:** React 19、TypeScript、axios、pdfjs-dist、Express、Prisma、Node.js

---

## File Structure

- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`
  - 当前 `PdfPageViewer`、`WellHistoryPage` 都在这个文件里，第一版沿用现状，不做大拆分
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\server.ts`
  - 新增编辑层查询、保存、导出接口
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\prisma\schema.prisma`
  - 新增 PDF 覆盖编辑层表
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\README.md`
  - 补充井史 PDF 轻量编辑与导出说明

## Task 1: 建立编辑层数据模型

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\prisma\schema.prisma`

- [ ] **Step 1: 在 Prisma schema 中新增 `WellHistoryPdfOverlay` 表**

```prisma
model WellHistoryPdfOverlay {
  id          String   @id @default(cuid())
  wellNo      String
  pdfId       String
  elementsJson Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([wellNo, pdfId])
}
```

- [ ] **Step 2: 运行 Prisma 校验**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 3: 生成 Prisma Client**

Run: `npx prisma generate --no-engine`
Expected: `Generated Prisma Client`

- [ ] **Step 4: 将新表同步到本地数据库**

Run: `npx prisma db push`
Expected: 新表 `WellHistoryPdfOverlay` 创建成功

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add well history pdf overlay model"
```

## Task 2: 新增编辑层查询与保存接口

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\server.ts`

- [ ] **Step 1: 在 `server.ts` 中定义编辑层接口请求体结构**

```ts
type WellHistoryOverlayElement = Record<string, unknown>;

type WellHistoryOverlayPayload = {
  pdfId: string;
  elementsJson: {
    version: number;
    elements: WellHistoryOverlayElement[];
  };
};
```

- [ ] **Step 2: 新增查询当前井号编辑层接口**

```ts
app.get("/api/well-history-archives/:wellNo/pdf-overlay", async (req, res) => {
  const requestedWellNo = typeof req.params.wellNo === "string" ? req.params.wellNo.trim() : "";
  const normalizedWellNo = normalizeWellHistoryWellNo(requestedWellNo);
  const wellNo = normalizedWellNo || requestedWellNo;

  if (!wellNo) {
    return res.status(400).json({ error: "wellNo is required" });
  }

  const archive = await snapshotPrisma.wellHistoryArchive?.findUnique({
    where: { wellNo },
    include: { currentPdf: true },
  });

  if (!archive?.currentPdf?.id) {
    return res.status(404).json({ error: "Well history PDF not found" });
  }

  const overlay = await snapshotPrisma.wellHistoryPdfOverlay?.findUnique({
    where: {
      wellNo_pdfId: {
        wellNo,
        pdfId: archive.currentPdf.id,
      },
    },
  });

  res.json({
    wellNo,
    pdfId: archive.currentPdf.id,
    elementsJson: overlay?.elementsJson ?? { version: 1, elements: [] },
    updatedAt: overlay?.updatedAt ?? null,
  });
});
```

- [ ] **Step 3: 新增保存当前井号编辑层接口**

```ts
app.post("/api/well-history-archives/:wellNo/pdf-overlay", async (req, res) => {
  const requestedWellNo = typeof req.params.wellNo === "string" ? req.params.wellNo.trim() : "";
  const normalizedWellNo = normalizeWellHistoryWellNo(requestedWellNo);
  const wellNo = normalizedWellNo || requestedWellNo;
  const body = req.body as WellHistoryOverlayPayload;

  if (!wellNo) {
    return res.status(400).json({ error: "wellNo is required" });
  }

  if (!body?.pdfId || !body?.elementsJson || !Array.isArray(body.elementsJson.elements)) {
    return res.status(400).json({ error: "pdfId and elementsJson are required" });
  }

  const saved = await snapshotPrisma.wellHistoryPdfOverlay?.upsert({
    where: {
      wellNo_pdfId: {
        wellNo,
        pdfId: body.pdfId,
      },
    },
    create: {
      wellNo,
      pdfId: body.pdfId,
      elementsJson: body.elementsJson,
    },
    update: {
      elementsJson: body.elementsJson,
    },
  });

  res.json(saved);
});
```

- [ ] **Step 4: 运行服务端类型校验**

Run: `npm run lint`
Expected: 仍只剩项目里原有旧报错，不新增 `pdf-overlay` 接口相关新错误

- [ ] **Step 5: Commit**

```bash
git add server.ts
git commit -m "feat: add well history pdf overlay APIs"
```

## Task 3: 搭建前端工具条与状态

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`

- [ ] **Step 1: 在 `App.tsx` 中定义编辑工具类型**

```ts
type PdfEditorTool = 'select' | 'rect' | 'arrow' | 'text';

type PdfOverlayElement =
  | {
      id: string;
      page: number;
      type: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      stroke: string;
    }
  | {
      id: string;
      page: number;
      type: 'arrow';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
    }
  | {
      id: string;
      page: number;
      type: 'text';
      x: number;
      y: number;
      text: string;
      fontSize: number;
      color: string;
    };
```

- [ ] **Step 2: 为 `PdfPageViewer` 增加阅读与编辑状态**

```ts
const [scale, setScale] = useState(1.35);
const [activeTool, setActiveTool] = useState<PdfEditorTool>('select');
const [overlayElements, setOverlayElements] = useState<PdfOverlayElement[]>([]);
const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
const [savingOverlay, setSavingOverlay] = useState(false);
const [downloadingOverlay, setDownloadingOverlay] = useState(false);
```

- [ ] **Step 3: 在右侧 PDF 标题下方插入工具条 UI**

```tsx
<div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
  <div className="flex flex-wrap items-center gap-2">
    <button type="button">放大</button>
    <button type="button">缩小</button>
    <button type="button">自适应</button>
    <button type="button">选择</button>
    <button type="button">矩形标注</button>
    <button type="button">箭头标注</button>
    <button type="button">文本编辑</button>
    <button type="button">保存</button>
    <button type="button">下载</button>
  </div>
</div>
```

- [ ] **Step 4: 先接通放大、缩小、自适应状态切换**

```ts
const zoomIn = () => setScale(prev => Number((prev + 0.15).toFixed(2)));
const zoomOut = () => setScale(prev => Math.max(0.5, Number((prev - 0.15).toFixed(2))));
const fitToWidth = () => setScale(1.1);
```

- [ ] **Step 5: 运行构建验证基础工具条可编译**

Run: `npm run build`
Expected: build 通过，右侧 PDF 标题下方出现工具条

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add pdf editor toolbar shell"
```

## Task 4: 让 PDF 页面对缩放生效

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`

- [ ] **Step 1: 将 `PdfPageViewer` 内的固定缩放改为状态值**

```ts
const viewport = page.getViewport({ scale });
```

- [ ] **Step 2: 当 `scale` 变化时重新渲染 PDF**

```ts
useEffect(() => {
  void renderPdf();
}, [fileUrl, wellNo, scale]);
```

- [ ] **Step 3: 手动验证放大缩小自适应**

Run: `npm run build`
Expected: 构建通过，放大缩小后 PDF 页面尺寸变化

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire pdf zoom controls"
```

## Task 5: 为每页增加覆盖编辑层容器

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`

- [ ] **Step 1: 渲染每页时将 canvas 包进相对定位容器**

```ts
const pageWrapper = document.createElement('div');
pageWrapper.className = 'relative mx-auto mb-4 w-fit';
pageWrapper.appendChild(canvas);
container.appendChild(pageWrapper);
```

- [ ] **Step 2: 在每页 wrapper 内追加 SVG 覆盖层**

```ts
const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
overlay.setAttribute('width', String(viewport.width));
overlay.setAttribute('height', String(viewport.height));
overlay.setAttribute('class', 'absolute inset-0 z-10');
pageWrapper.appendChild(overlay);
```

- [ ] **Step 3: 先把当前页已有元素渲染到覆盖层**

```ts
const pageElements = overlayElements.filter(item => item.page === pageNumber);
```

- [ ] **Step 4: 构建验证页面仍能正常显示**

Run: `npm run build`
Expected: PDF 仍正常显示，覆盖层不遮挡阅读

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add pdf overlay layer containers"
```

## Task 6: 实现矩形标注

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`

- [ ] **Step 1: 在覆盖层上接入拖拽创建矩形逻辑**

```ts
type DragState = {
  page: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
} | null;
```

- [ ] **Step 2: 在 `activeTool === 'rect'` 时生成矩形元素**

```ts
const nextRect: PdfOverlayElement = {
  id: crypto.randomUUID(),
  page: pageNumber,
  type: 'rect',
  x: normalizedX,
  y: normalizedY,
  width: normalizedWidth,
  height: normalizedHeight,
  stroke: '#ef4444',
};
```

- [ ] **Step 3: 将矩形渲染到 SVG 覆盖层**

```ts
<rect
  x={x * pageWidth}
  y={y * pageHeight}
  width={width * pageWidth}
  height={height * pageHeight}
  fill="none"
  stroke={stroke}
  strokeWidth="2"
/>
```

- [ ] **Step 4: 手动验证矩形标注可创建**

Run: `npm run build`
Expected: 页面中可拖出红色矩形标注

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: support rectangle annotations"
```

## Task 7: 实现箭头标注

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`

- [ ] **Step 1: 在 `activeTool === 'arrow'` 时记录起止点**

```ts
const nextArrow: PdfOverlayElement = {
  id: crypto.randomUUID(),
  page: pageNumber,
  type: 'arrow',
  x1: normalizedX1,
  y1: normalizedY1,
  x2: normalizedX2,
  y2: normalizedY2,
  stroke: '#f59e0b',
};
```

- [ ] **Step 2: 在 SVG 中用线段 + 箭头头部渲染**

```tsx
<line
  x1={x1 * pageWidth}
  y1={y1 * pageHeight}
  x2={x2 * pageWidth}
  y2={y2 * pageHeight}
  stroke={stroke}
  strokeWidth="2"
/>
```

- [ ] **Step 3: 手动验证箭头标注**

Run: `npm run build`
Expected: 页面中可拖出箭头标注

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: support arrow annotations"
```

## Task 8: 实现文本编辑

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`

- [ ] **Step 1: 在 `activeTool === 'text'` 时点击创建文本元素**

```ts
const nextText: PdfOverlayElement = {
  id: crypto.randomUUID(),
  page: pageNumber,
  type: 'text',
  x: normalizedX,
  y: normalizedY,
  text: '请输入说明',
  fontSize: 14,
  color: '#1f2937',
};
```

- [ ] **Step 2: 为文本元素增加简单编辑输入**

```tsx
<foreignObject ...>
  <input
    value={text}
    onChange={...}
  />
</foreignObject>
```

- [ ] **Step 3: 支持文本位置拖动与选中**

```ts
setSelectedElementId(element.id);
```

- [ ] **Step 4: 手动验证文本框可添加和修改**

Run: `npm run build`
Expected: 点击页面后可添加文本框并编辑文字

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: support text annotations"
```

## Task 9: 保存并恢复编辑层

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\server.ts`

- [ ] **Step 1: 页面加载 PDF 后拉取当前编辑层**

```ts
const { data } = await axios.get(`/api/well-history-archives/${encodeURIComponent(wellNo)}/pdf-overlay`);
setOverlayElements(data?.elementsJson?.elements ?? []);
```

- [ ] **Step 2: 点击保存时提交编辑层**

```ts
await axios.post(`/api/well-history-archives/${encodeURIComponent(wellNo)}/pdf-overlay`, {
  pdfId: archiveDetail?.currentPdf?.id,
  elementsJson: {
    version: 1,
    elements: overlayElements,
  },
});
```

- [ ] **Step 3: 保存成功后提示用户**

```ts
addNotification('井史编辑已保存', '当前页面编辑内容已保存，可继续维护。', 'success');
```

- [ ] **Step 4: 手动验证刷新恢复**

Run: `npm run build`
Expected: 保存后刷新页面，矩形/箭头/文本能恢复

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx server.ts
git commit -m "feat: persist well history pdf overlays"
```

## Task 10: 导出带编辑结果的文件

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\server.ts`
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`

- [ ] **Step 1: 后端新增导出接口骨架**

```ts
app.post("/api/well-history-archives/:wellNo/pdf-export", async (req, res) => {
  res.status(501).json({ error: "PDF export not implemented yet" });
});
```

- [ ] **Step 2: 将当前编辑层和 PDF 内容组合导出**

```ts
// 第一版实现要求：
// 1. 读取当前 PDF
// 2. 将 overlayElements 转换为页面标注
// 3. 生成导出 PDF Buffer
// 4. 以 attachment 方式返回
```

- [ ] **Step 3: 前端接入下载按钮**

```ts
const response = await axios.post(
  `/api/well-history-archives/${encodeURIComponent(wellNo)}/pdf-export`,
  {
    pdfId: archiveDetail?.currentPdf?.id,
  },
  { responseType: 'blob' }
);
```

- [ ] **Step 4: 触发浏览器下载**

```ts
const url = URL.createObjectURL(response.data);
const link = document.createElement('a');
link.href = url;
link.download = `${wellNo}-井史标注版.pdf`;
link.click();
URL.revokeObjectURL(url);
```

- [ ] **Step 5: 手动验证下载文件**

Run: `npm run build`
Expected: 点击下载后得到带标注和文字的新 PDF，原始 PDF 不变

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx server.ts
git commit -m "feat: export annotated well history pdf"
```

## Task 11: 文档更新

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\README.md`

- [ ] **Step 1: 在 README 中补充单井井史编辑能力说明**

```md
### 单井井史 PDF 轻量编辑

- 支持放大、缩小、自适应
- 支持矩形、箭头、文本标注
- 支持保存当前页面编辑层
- 支持下载导出标注版 PDF
- 原始 PDF 文件不会被覆盖
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: describe well history pdf editor"
```

## Self-Review

- Spec coverage:
  - 工具条：Task 3
  - 缩放：Task 4
  - 矩形标注：Task 6
  - 箭头标注：Task 7
  - 文本编辑：Task 8
  - 保存继续编辑版本：Task 9
  - 下载导出：Task 10
  - 原始 PDF 不变：Task 9 + Task 10
- Placeholder scan:
  - 已避免 `TODO/TBD`，每项都给出了文件、步骤、命令或代码骨架
- Type consistency:
  - 统一使用 `PdfOverlayElement`、`PdfEditorTool`、`elementsJson`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-well-history-pdf-light-editor.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
