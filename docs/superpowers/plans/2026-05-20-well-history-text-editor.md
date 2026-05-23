# 单井井史"文本编辑"功能改造 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单井井史页面的文本编辑从简单 input 升级为富文本模态编辑器 + 可拖放便签卡片，支持脏状态追踪和离开确认。

**Architecture:** 所有改动集中在 `src/App.tsx`。新增 `PdfStickyNoteElement` 类型和 `RichTextEditorModal` 组件，扩展 `WellHistoryPdfEditor` 的工具栏和叠加渲染，扩展 `WellHistoryPage` 的脏状态和离开确认逻辑。无需动数据库或后端 API。

**Tech Stack:** React 19, TypeScript, contentEditable (浏览器内置), 无额外 npm 依赖

---

## 文件结构

| 文件 | 职责 | 变更类型 |
|------|------|----------|
| `src/App.tsx` | 所有类型、组件和逻辑 | 修改（约 +300 行） |

关键区域：
- L238-278: 类型定义 → 新增 `PdfStickyNoteElement` 类型
- L703-1308: `WellHistoryPdfEditor` → 新增 RichTextEditorModal、StickyNoteCard、工具栏变更
- L4845-5425: `WellHistoryPage` → 新增 dirty state、leave confirmation
- L1072-1137: `downloadAnnotatedPdf` → 新增 sticky 渲染逻辑

---

### Task 1: 新增 PdfStickyNoteElement 类型

**Files:**
- Modify: `src/App.tsx:238,273`

**Steps:**

- [ ] **Step 1: 在 PdfEditorTool 后追加 PdfStickyNoteElement 类型定义**

在 L238 (`type PdfEditorTool = 'select' | 'rect' | 'arrow' | 'text';`) 后插入：

```typescript
type StickyNoteColor = 'yellow' | 'blue' | 'green' | 'pink';

interface PdfStickyNoteElement {
  type: 'sticky';
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  content: string;
  color: StickyNoteColor;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: 更新 PdfOverlayElement 联合类型**

将 L273 的：
```typescript
type PdfOverlayElement = PdfRectOverlayElement | PdfArrowOverlayElement | PdfTextOverlayElement;
```
改为：
```typescript
type PdfOverlayElement = PdfRectOverlayElement | PdfArrowOverlayElement | PdfTextOverlayElement | PdfStickyNoteElement;
```

- [ ] **Step 3: 运行类型检查确认无误**

```bash
cd "C:/Users/31541/Desktop/0510ZS/B/gszhushuiSQL/gszhushuiSQL" && npx tsc --noEmit 2>&1 | head -30
```
预期：仅新类型相关的类型错误（尚未在组件中使用），无意外错误。

---

### Task 2: 创建 RichTextEditorModal 组件

**Files:**
- Modify: `src/App.tsx`（在 WellHistoryPdfEditor 之前插入）

**Steps:**

- [ ] **Step 1: 在 WellHistoryPdfEditor（L703 之前）插入 STICKY_COLORS 常量和 RichTextEditorModal 组件**

```typescript
const STICKY_COLORS: Record<StickyNoteColor, { bg: string; header: string; border: string; text: string }> = {
  yellow: { bg: '#fffbeb', header: '#fef3c7', border: '#fcd34d', text: '#78350f' },
  blue: { bg: '#eff6ff', header: '#dbeafe', border: '#93c5fd', text: '#1e3a5f' },
  green: { bg: '#f0fdf4', header: '#dcfce7', border: '#86efac', text: '#14532d' },
  pink: { bg: '#fdf2f8', header: '#fce7f3', border: '#f9a8d4', text: '#831843' },
};

const RichTextEditorModal = ({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (sticky: { title: string; content: string; color: StickyNoteColor }) => void;
  initial?: { title: string; content: string; color: StickyNoteColor };
}) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [color, setColor] = useState<StickyNoteColor>(initial?.color ?? 'yellow');
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setContent(initial?.content ?? '');
    setColor(initial?.color ?? 'yellow');
    requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
  }, [open, initial?.title, initial?.content, initial?.color]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleSave = () => {
    const trimmedContent = (editorRef.current?.innerHTML ?? content).trim();
    if (!trimmedContent || trimmedContent === '<br>') return;
    onSave({ title: title.trim(), content: trimmedContent, color });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-bold text-gray-900">
            {initial ? '编辑补充说明' : '新增补充说明'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">&times;</button>
        </div>

        <div className="px-5 py-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题（可选）"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 px-5 py-2">
          <button type="button" onClick={() => execCommand('bold')} className="rounded px-2 py-1 text-xs font-bold hover:bg-gray-100">B</button>
          <button type="button" onClick={() => execCommand('italic')} className="rounded px-2 py-1 text-xs italic hover:bg-gray-100">I</button>
          <button type="button" onClick={() => execCommand('underline')} className="rounded px-2 py-1 text-xs underline hover:bg-gray-100">U</button>
          <span className="mx-1 h-4 w-px bg-gray-200" />
          <button type="button" onClick={() => execCommand('formatBlock', '<h2>')} className="rounded px-2 py-1 text-xs font-bold hover:bg-gray-100">H1</button>
          <button type="button" onClick={() => execCommand('formatBlock', '<h3>')} className="rounded px-2 py-1 text-xs font-bold hover:bg-gray-100">H2</button>
          <span className="mx-1 h-4 w-px bg-gray-200" />
          <button type="button" onClick={() => execCommand('insertUnorderedList')} className="rounded px-2 py-1 text-xs hover:bg-gray-100">• 列表</button>
          <button type="button" onClick={() => execCommand('insertOrderedList')} className="rounded px-2 py-1 text-xs hover:bg-gray-100">1. 编号</button>
          <span className="mx-1 h-4 w-px bg-gray-200" />
          {(Object.keys(STICKY_COLORS) as StickyNoteColor[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-6 w-6 rounded-full border-2 transition-colors"
              style={{
                backgroundColor: STICKY_COLORS[c].header,
                borderColor: color === c ? '#3b82f6' : STICKY_COLORS[c].border,
              }}
              title={c}
            />
          ))}
        </div>

        <div className="px-5 py-4">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[160px] rounded-md border border-gray-100 bg-gray-50 p-3 text-sm leading-relaxed text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
            dangerouslySetInnerHTML={{ __html: content }}
            onInput={(e) => setContent(e.currentTarget.innerHTML)}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">取消</button>
          <button type="button" onClick={handleSave} className="rounded-lg bg-cnpc-red px-4 py-2 text-xs font-bold text-white hover:bg-red-700">保存并放置</button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 运行类型检查确认组件无类型错误**

```bash
cd "C:/Users/31541/Desktop/0510ZS/B/gszhushuiSQL/gszhushuiSQL" && npx tsc --noEmit 2>&1 | head -30
```

---

### Task 3: 扩展 WellHistoryPdfEditor — 新增 sticky 状态和编辑器集成

**Files:**
- Modify: `src/App.tsx:703-736`（WellHistoryPdfEditor 状态区域）

**Steps:**

- [ ] **Step 1: 在 WellHistoryPdfEditor 状态区域新增 sticky 相关状态**

在 L718 (`downloadingOverlay`) 之后插入：

```typescript
const [stickyEditorOpen, setStickyEditorOpen] = useState(false);
const [editingStickyId, setEditingStickyId] = useState<string | null>(null);
const [stickyModalInitial, setStickyModalInitial] = useState<{ title: string; content: string; color: StickyNoteColor } | undefined>(undefined);
```

- [ ] **Step 2: 新增 sticky 保存处理函数**

在 L736 (toolButtonClass 定义之后) 插入：

```typescript
const handleSaveSticky = (sticky: { title: string; content: string; color: StickyNoteColor }) => {
  if (editingStickyId) {
    setOverlayElements(prev => prev.map(item =>
      item.type === 'sticky' && item.id === editingStickyId
        ? { ...item, title: sticky.title, content: sticky.content, color: sticky.color, updatedAt: new Date().toISOString() }
        : item
    ));
    setEditingStickyId(null);
  } else {
    const newSticky: PdfStickyNoteElement = {
      type: 'sticky',
      id: crypto.randomUUID(),
      page: 1,
      x: 0.05,
      y: 0.05,
      width: 0.28,
      height: 0.22,
      title: sticky.title,
      content: sticky.content,
      color: sticky.color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setOverlayElements(prev => [...prev, newSticky]);
    setSelectedElementId(newSticky.id);
  }
};

const handleOpenStickyEditor = () => {
  setEditingStickyId(null);
  setStickyModalInitial(undefined);
  setStickyEditorOpen(true);
};

const handleEditSticky = (element: PdfStickyNoteElement) => {
  setEditingStickyId(element.id);
  setStickyModalInitial({ title: element.title, content: element.content, color: element.color });
  setStickyEditorOpen(true);
};

const handleDeleteSticky = (elementId: string) => {
  setOverlayElements(prev => prev.filter(item => item.id !== elementId));
  if (selectedElementId === elementId) {
    setSelectedElementId(null);
  }
  if (editingStickyId === elementId) {
    setEditingStickyId(null);
  }
};
```

- [ ] **Step 3: 类型检查**

```bash
cd "C:/Users/31541/Desktop/0510ZS/B/gszhushuiSQL/gszhushuiSQL" && npx tsc --noEmit 2>&1 | head -40
```

---

### Task 4: 扩展 WellHistoryPdfEditor — 新增 sticky 拖放

**Files:**
- Modify: `src/App.tsx:765-797`（现有 text 拖放处理）

**Steps:**

- [ ] **Step 1: 扩展 draggingText 状态以支持 sticky 类型**

将 L727-735 的 `draggingText` 状态类型改为支持 sticky：

```typescript
const [draggingElement, setDraggingElement] = useState<{
  id: string;
  elementType: 'text' | 'sticky';
  pageWidth: number;
  pageHeight: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
} | null>(null);
```

- [ ] **Step 2: 扩展拖放事件处理以支持 sticky**

将 L765-797 的 useEffect 中 `draggingText` 替换为 `draggingElement`，并更新 mousemove 处理逻辑：

```typescript
useEffect(() => {
  if (!draggingElement) return;

  const onMouseMove = (event: MouseEvent) => {
    const deltaX = (event.clientX - draggingElement.startClientX) / draggingElement.pageWidth;
    const deltaY = (event.clientY - draggingElement.startClientY) / draggingElement.pageHeight;

    setOverlayElements(prev => prev.map(item => {
      if (item.id !== draggingElement.id) return item;
      if (draggingElement.elementType === 'text' && item.type === 'text') {
        return { ...item, x: Math.min(Math.max(draggingElement.originX + deltaX, 0), 0.96), y: Math.min(Math.max(draggingElement.originY + deltaY, 0), 0.98) };
      }
      if (draggingElement.elementType === 'sticky' && item.type === 'sticky') {
        return { ...item, x: Math.min(Math.max(draggingElement.originX + deltaX, 0), 1 - item.width), y: Math.min(Math.max(draggingElement.originY + deltaY, 0), 1 - item.height) };
      }
      return item;
    }));
  };

  const onMouseUp = () => setDraggingElement(null);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  return () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
}, [draggingElement]);
```

- [ ] **Step 3: 更新 beginTextDrag 中的 setDraggingText 引用**

将 L1042 的 `setDraggingText` 调用中的类型字段更新：

```typescript
setDraggingElement({
  id: element.id,
  elementType: 'text',
  pageWidth: page.width,
  pageHeight: page.height,
  startClientX: event.clientX,
  startClientY: event.clientY,
  originX: element.x,
  originY: element.y,
});
```

- [ ] **Step 4: 新增 beginStickyDrag 函数**

在 L1051 后插入：

```typescript
const beginStickyDrag = (
  event: React.MouseEvent<HTMLDivElement>,
  element: PdfStickyNoteElement,
  page: PdfRenderedPage
) => {
  event.preventDefault();
  event.stopPropagation();
  setSelectedElementId(element.id);
  setDraggingElement({
    id: element.id,
    elementType: 'sticky',
    pageWidth: page.width,
    pageHeight: page.height,
    startClientX: event.clientX,
    startClientY: event.clientY,
    originX: element.x,
    originY: element.y,
  });
};
```

- [ ] **Step 5: 类型检查**

```bash
cd "C:/Users/31541/Desktop/0510ZS/B/gszhushuiSQL/gszhushuiSQL" && npx tsc --noEmit 2>&1 | head -40
```

---

### Task 5: 扩展 WellHistoryPdfEditor — 工具栏和 UI 渲染

**Files:**
- Modify: `src/App.tsx:1141-1308`（工具栏和渲染区域）

**Steps:**

- [ ] **Step 1: 更新工具栏按钮**

替换 L1151（当前"文本编辑"按钮）为两个按钮：

```typescript
<button type="button" onClick={handleOpenStickyEditor} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100">✏️ 补充说明</button>
<button type="button" onClick={() => setActiveTool('text')} className={toolButtonClass('text')}>文字</button>
```

- [ ] **Step 2: 在页面渲染循环中新增 sticky 元素的 DOM 渲染**

在现有 text 元素渲染的 `div` 之后（L1302 之后，即现有的 `</div>` 和 `))}` 之间），新增 sticky 渲染：

```typescript
{pageElements(page.pageNumber).filter((item): item is PdfStickyNoteElement => item.type === 'sticky').map(element => {
  const colorDef = STICKY_COLORS[element.color] ?? STICKY_COLORS.yellow;
  return (
    <div
      key={element.id}
      className={cn(
        'absolute z-20 overflow-hidden rounded-lg border-2 shadow-md',
        selectedElementId === element.id ? 'ring-2 ring-blue-400' : ''
      )}
      style={{
        left: `${element.x * page.width}px`,
        top: `${element.y * page.height}px`,
        width: `${element.width * page.width}px`,
        maxHeight: `${element.height * page.height}px`,
        backgroundColor: colorDef.bg,
        borderColor: colorDef.border,
        cursor: draggingElement?.id === element.id ? 'grabbing' : 'grab',
      }}
      onMouseDown={(event) => beginStickyDrag(event, element, page)}
      onClick={(event) => {
        event.stopPropagation();
        setSelectedElementId(element.id);
      }}
    >
      <div
        className="flex items-center justify-between px-2 py-1"
        style={{ backgroundColor: colorDef.header }}
      >
        <span className="truncate text-xs font-bold" style={{ color: colorDef.text }}>
          {element.title || '补充说明'}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleEditSticky(element); }}
            className="rounded p-0.5 text-xs hover:bg-black/10"
            title="编辑"
          >✏️</button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDeleteSticky(element.id); }}
            className="rounded p-0.5 text-xs hover:bg-black/10"
            title="删除"
          >🗑</button>
        </span>
      </div>
      <div
        className="overflow-hidden px-2 py-1 text-xs leading-snug"
        style={{ color: colorDef.text, maxHeight: `${element.height * page.height - 32}px` }}
        dangerouslySetInnerHTML={{ __html: element.content }}
      />
    </div>
  );
})}
```

- [ ] **Step 3: 在组件末尾（return 语句最后，L1308 的 `};` 之前）添加 RichTextEditorModal**

```typescript
<RichTextEditorModal
  open={stickyEditorOpen}
  onClose={() => { setStickyEditorOpen(false); setEditingStickyId(null); }}
  onSave={handleSaveSticky}
  initial={stickyModalInitial}
/>
```

- [ ] **Step 4: 更新 pageElements 过滤函数以包含 sticky 元素**

当前 L1139 的 `pageElements` 已经使用 `.filter(item => item.page === pageNumber)`，sticky 元素也有 `page` 字段，无需更改。

- [ ] **Step 5: 类型检查**

```bash
cd "C:/Users/31541/Desktop/0510ZS/B/gszhushuiSQL/gszhushuiSQL" && npx tsc --noEmit 2>&1 | head -40
```

---

### Task 6: 扩展 downloadAnnotatedPdf 以支持 sticky 渲染

**Files:**
- Modify: `src/App.tsx:1072-1137`

**Steps:**

- [ ] **Step 1: 在 downloadAnnotatedPdf 中新增 sticky 渲染分支**

在 L1112（现有 text 渲染分支的 `}`);
` 之后、L1114 的 `page.drawText` 之前）插入 sticky 渲染逻辑：

```typescript
if (element.type === 'sticky') {
  const boxX = element.x * pageWidth;
  const boxY = pageHeight - (element.y + element.height) * pageHeight;
  const boxW = element.width * pageWidth;
  const boxH = element.height * pageHeight;

  const colorDef = STICKY_COLORS[element.color] ?? STICKY_COLORS.yellow;
  const headerH = 16;

  page.drawRectangle({
    x: boxX, y: boxY + boxH - headerH,
    width: boxW, height: headerH,
    color: toPdfColor(colorDef.header.replace('#', '')),
  });

  page.drawText(element.title || '', {
    x: boxX + 4, y: boxY + boxH - 12,
    size: 8, font, color: toPdfColor(colorDef.text.replace('#', '')),
  });

  const bodyText = element.content.replace(/<[^>]+>/g, '').substring(0, 300);
  const lines = bodyText.match(/.{1,50}/g) ?? [bodyText];
  lines.slice(0, 8).forEach((line, i) => {
    page.drawText(line, {
      x: boxX + 4, y: boxY + boxH - headerH - 12 - i * 10,
      size: 7, font, color: toPdfColor('#374151'),
    });
  });
  return;
}
```

- [ ] **Step 2: 类型检查**

```bash
cd "C:/Users/31541/Desktop/0510ZS/B/gszhushuiSQL/gszhushuiSQL" && npx tsc --noEmit 2>&1 | head -40
```

---

### Task 7: WellHistoryPage 脏状态和离开确认

**Files:**
- Modify: `src/App.tsx:4845-5425`

**Steps:**

- [ ] **Step 1: 将 dirty state 传递机制加入 WellHistoryPdfEditor**

首先修改 `WellHistoryPdfEditor` 的 props，新增 `onDirtyChange` 回调：

L703 改为：
```typescript
const WellHistoryPdfEditor = ({ fileUrl, wellNo, pdfId, onDirtyChange }: { fileUrl: string; wellNo: string; pdfId?: string; onDirtyChange?: (dirty: boolean) => void }) => {
```

新增 dirty 追踪 ref：

```typescript
const overlayBaselineRef = useRef<string | null>(null);
```

在现有的 loadPdf effect（约 L917，setOverlayElements(loadedElements) 之后）中，添加基线初始化：

```typescript
setOverlayElements(loadedElements);
if (overlayBaselineRef.current === null) {
  overlayBaselineRef.current = JSON.stringify(loadedElements);
}
```

新增 dirty 追踪 effect（放在所有 state 定义之后）：

```typescript
useEffect(() => {
  if (!onDirtyChange || overlayBaselineRef.current === null) return;
  const current = JSON.stringify(overlayElements);
  onDirtyChange(current !== overlayBaselineRef.current);
}, [overlayElements, onDirtyChange]);
```

保存成功后重置基线：
```typescript
const saveOverlay = async () => {
  if (!pdfId) { ... return; }
  setSavingOverlay(true);
  try {
    await axios.post(...);
    addNotification(...);
    overlayBaselineRef.current = JSON.stringify(overlayElements);
    onDirtyChange?.(false);
  } catch (...) { ... }
  finally { setSavingOverlay(false); }
};
```

- [ ] **Step 2: 在 WellHistoryPage 中新增 dirty 状态和确认对话框状态**

在 L4860 附近新增：
```typescript
const [isOverlayDirty, setIsOverlayDirty] = useState(false);
const [pendingWellNo, setPendingWellNo] = useState<string | null>(null);
const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
```

- [ ] **Step 3: 修改 searchWellHistoryArchives 和 loadArchiveDetail 触发前的脏检查**

将 L5176 的"查询井史"按钮 onClick 改为：
```typescript
onClick={() => {
  if (isOverlayDirty) {
    setPendingWellNo(wellNo);
    setShowLeaveConfirm(true);
  } else {
    void loadArchiveDetail(wellNo);
  }
}}
```

类似地，修改建议项点击（L5158）：
```typescript
onClick={() => {
  if (isOverlayDirty) {
    setPendingWellNo(item.wellNo);
    setShowLeaveConfirm(true);
  } else {
    void loadArchiveDetail(item.wellNo);
  }
}}
```

- [ ] **Step 4: 新增离开确认对话框组件（内联在 WellHistoryPage 中）**

在 WellHistoryPdfEditor 使用处（L5398）传入 onDirtyChange：
```typescript
<WellHistoryPdfEditor
  fileUrl={archiveDetail.currentPdf.fileUrl}
  wellNo={archiveDetail.wellNo}
  pdfId={archiveDetail.currentPdf.id}
  onDirtyChange={setIsOverlayDirty}
/>
```

- [ ] **Step 5: 在 WellHistoryPage 的 return 区域末尾添加确认对话框**

```typescript
{showLeaveConfirm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl text-center">
      <div className="mb-2 text-3xl">⚠️</div>
      <h3 className="mb-1 text-sm font-bold text-gray-900">有未保存的更改</h3>
      <p className="mb-4 text-xs text-gray-500">当前井史的补充说明尚未保存，切换后将丢失编辑内容。</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={async () => {
            setShowLeaveConfirm(false);
            setIsOverlayDirty(false);
            if (pendingWellNo) {
              await loadArchiveDetail(pendingWellNo);
              setPendingWellNo(null);
            }
          }}
          className="w-full rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600"
        >不保存，直接切换</button>
        <button
          type="button"
          onClick={() => {
            setShowLeaveConfirm(false);
            setPendingWellNo(null);
          }}
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >取消</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: 类型检查**

```bash
cd "C:/Users/31541/Desktop/0510ZS/B/gszhushuiSQL/gszhushuiSQL" && npx tsc --noEmit 2>&1 | head -40
```

---

### Task 8: 运行验证和修复

**Steps:**

- [ ] **Step 1: 启动开发服务器**

```bash
cd "C:/Users/31541/Desktop/0510ZS/B/gszhushuiSQL/gszhushuiSQL" && npm run dev 2>&1 &
```

等待服务器启动（监听端口 5000）。

- [ ] **Step 2: 验证应用可访问**

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/
```
预期：`200`

- [ ] **Step 3: 手动验证功能清单**

在浏览器中打开 `http://127.0.0.1:5000/`，导航到"单井井史"页面：

1. 搜索一口已有 PDF 的井（如 GS-101）
2. 确认"原始井史 PDF"区域显示 PDF
3. 点击"✏️ 补充说明"按钮 → 模态编辑器打开
4. 输入标题和富文本内容（加粗、列表等）
5. 选择颜色，点击"保存并放置" → 便签出现在 PDF 页面上
6. 拖放便签到新位置
7. 点击便签上的编辑图标 → 重新打开编辑器，保留原有内容
8. 点击工具栏"保存" → 提示保存成功
9. 修改便签内容（不保存），点击查询新井 → 弹出离开确认对话框
10. 验证融合PDF下载功能

- [ ] **Step 4: 修复发现的问题**

根据测试结果修改代码。重点关注：
- 便签拖放坐标计算
- 模态编辑器内容同步
- 脏状态追踪时机
- 离开确认对话框的触发条件

- [ ] **Step 5: 最终类型检查**

```bash
cd "C:/Users/31541/Desktop/0510ZS/B/gszhushuiSQL/gszhushuiSQL" && npx tsc --noEmit 2>&1
```
预期：无错误。
