# Well History PDF Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build per-well PDF upload, query, preview, and in-page replacement for the `单井井史` page so different well numbers automatically show different PDFs.

**Architecture:** Store PDF files on disk under the existing `uploads` tree and persist only metadata in Prisma/PostgreSQL. Extend the Express server with well-history PDF upload and lookup endpoints, then replace the current placeholder `WellHistoryPage` content with a query + preview + update workflow that refreshes itself after uploads.

**Tech Stack:** React 19, Axios, Express, Prisma, PostgreSQL, local file uploads, existing `/uploads` static hosting

---

## File Structure

- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\prisma\schema.prisma`
  - Add `WellHistoryPdf` model and unique well-number binding.
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\server.ts`
  - Add PDF upload/update endpoint, lookup endpoint, storage helpers, and file cleanup behavior.
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`
  - Rebuild `WellHistoryPage` around querying, PDF preview, upload, and update.
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\README.md`
  - Document the well-history PDF workflow after implementation.

### Task 1: Add Well-History PDF Persistence

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\prisma\schema.prisma`

- [ ] **Step 1: Add the Prisma model for current well-history PDF metadata**

Insert a model near the existing business models:

```prisma
model WellHistoryPdf {
  id             String   @id @default(uuid())
  wellNo         String   @unique
  unit           String?
  block          String?
  fileUrl        String
  storedFileName String
  originalName   String
  mimeType       String
  size           Int
  remark         String?  @db.Text
  uploadedAt     DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([unit])
  @@index([block])
}
```

- [ ] **Step 2: Generate Prisma client and push the schema**

Run:

```powershell
npx prisma generate
npx prisma db push
```

Expected:

```text
Prisma Client generated
Your database is now in sync with your Prisma schema
```

- [ ] **Step 3: Verify the model is available in the generated client**

Run:

```powershell
rg -n "WellHistoryPdf" prisma\schema.prisma node_modules\@prisma\client
```

Expected:

```text
Matches in prisma schema and generated Prisma client output
```

- [ ] **Step 4: Commit the schema change**

```bash
git add prisma/schema.prisma
git commit -m "feat: add well history pdf model"
```

### Task 2: Add Backend Upload and Lookup APIs

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\server.ts`

- [ ] **Step 1: Add a dedicated well-history upload directory and helpers**

Add constants and helpers near the existing upload helpers:

```ts
const WELL_HISTORY_UPLOAD_DIR = path.join(UPLOAD_ROOT, "well-history");

const ensureWellHistoryUploadDirectory = async () => {
  await fs.mkdir(WELL_HISTORY_UPLOAD_DIR, { recursive: true });
};

const sanitizeWellNo = (value: string) => value.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
```

- [ ] **Step 2: Add PDF upload/update endpoint**

Add a `POST /api/uploads/well-history-pdf` route that:

```ts
app.post("/api/uploads/well-history-pdf", async (req, res) => {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(key, item);
      } else if (typeof value === "string") {
        headers.append(key, value);
      }
    }

    const request = new Request(`http://${req.headers.host ?? "localhost"}${req.originalUrl}`, {
      method: req.method,
      headers,
      body: req as unknown as BodyInit,
      duplex: "half",
    } as any);

    const formData = await request.formData();
    const uploadedFile = formData.get("file");
    const wellNo = String(formData.get("wellNo") ?? "").trim();
    const unit = String(formData.get("unit") ?? "").trim() || null;
    const block = String(formData.get("block") ?? "").trim() || null;
    const remark = String(formData.get("remark") ?? "").trim() || null;

    if (!(uploadedFile instanceof File)) {
      return res.status(400).json({ error: "Missing PDF file" });
    }

    if (!wellNo) {
      return res.status(400).json({ error: "Missing well number" });
    }

    if (uploadedFile.type !== "application/pdf") {
      return res.status(400).json({ error: "Only PDF uploads are supported" });
    }

    if (uploadedFile.size > MAX_UPLOAD_BYTES * 5) {
      return res.status(413).json({ error: "PDF file too large" });
    }

    await ensureWellHistoryUploadDirectory();

    const safeWellNo = sanitizeWellNo(wellNo);
    const storedFileName = `well-history-${safeWellNo}-${Date.now()}-${randomUUID()}.pdf`;
    const diskPath = path.join(WELL_HISTORY_UPLOAD_DIR, storedFileName);
    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    await fs.writeFile(diskPath, fileBuffer);

    const existing = await prisma.wellHistoryPdf.findUnique({ where: { wellNo } });
    const fileUrl = `/uploads/well-history/${storedFileName}`;

    const record = existing
      ? await prisma.wellHistoryPdf.update({
          where: { wellNo },
          data: { unit, block, fileUrl, storedFileName, originalName: uploadedFile.name, mimeType: uploadedFile.type, size: uploadedFile.size, remark },
        })
      : await prisma.wellHistoryPdf.create({
          data: { wellNo, unit, block, fileUrl, storedFileName, originalName: uploadedFile.name, mimeType: uploadedFile.type, size: uploadedFile.size, remark },
        });

    if (existing?.storedFileName) {
      const oldPath = path.join(WELL_HISTORY_UPLOAD_DIR, existing.storedFileName);
      fs.unlink(oldPath).catch(error => console.error("Failed to remove old well history PDF:", error));
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: "Well history PDF upload failed", details: serializeError(error) });
  }
});
```

- [ ] **Step 3: Add lookup endpoint by well number**

Add:

```ts
app.get("/api/well-history-pdf", async (req, res) => {
  const wellNo = typeof req.query.wellNo === "string" ? req.query.wellNo.trim() : "";
  if (!wellNo) {
    return res.status(400).json({ error: "Missing wellNo" });
  }

  const record = await prisma.wellHistoryPdf.findUnique({ where: { wellNo } });
  if (!record) {
    return res.status(404).json({ error: "Well history PDF not found" });
  }

  res.json(record);
});
```

- [ ] **Step 4: Run typecheck for backend integration**

Run:

```powershell
npm run lint
```

Expected:

```text
No new TypeScript errors from the well-history upload endpoints
```

Note:
Existing unrelated TypeScript errors may still remain elsewhere in the repo. Only fix new errors introduced by this task.

- [ ] **Step 5: Commit the backend API work**

```bash
git add server.ts
git commit -m "feat: add well history pdf upload api"
```

### Task 3: Rebuild the Well-History Page Around PDF Query and Update

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`

- [ ] **Step 1: Add frontend types for the well-history PDF record**

Near existing frontend interfaces, add:

```ts
interface WellHistoryPdfRecord {
  id: string;
  wellNo: string;
  unit: string | null;
  block: string | null;
  fileUrl: string;
  storedFileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  remark: string | null;
  uploadedAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Replace placeholder `WellHistoryPage` state with query/upload state**

Inside `WellHistoryPage`, add state like:

```ts
const [selectedBlock, setSelectedBlock] = useState("牛心坨");
const [wellNo, setWellNo] = useState("GS-101");
const [pdfRecord, setPdfRecord] = useState<WellHistoryPdfRecord | null>(null);
const [pdfLoading, setPdfLoading] = useState(false);
const [pdfError, setPdfError] = useState("");
const [uploadingPdf, setUploadingPdf] = useState(false);
const pdfInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3: Add fetch and upload handlers**

Implement:

```ts
const fetchWellHistoryPdf = async (targetWellNo: string) => {
  setPdfLoading(true);
  setPdfError("");
  try {
    const { data } = await axios.get<WellHistoryPdfRecord>("/api/well-history-pdf", {
      params: { wellNo: targetWellNo },
    });
    setPdfRecord(data);
  } catch (error: any) {
    setPdfRecord(null);
    setPdfError(error.response?.status === 404 ? "该井暂无井史 PDF，请上传。" : "井史 PDF 查询失败");
  } finally {
    setPdfLoading(false);
  }
};

const handleUploadPdf = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("wellNo", wellNo);
  formData.append("unit", selectedUnit === "全厂汇总" ? "" : selectedUnit);
  formData.append("block", selectedBlock);

  setUploadingPdf(true);
  try {
    await axios.post("/api/uploads/well-history-pdf", formData);
    addNotification("上传成功", `${wellNo} 井史 PDF 已更新`, "success");
    logAction("井史资料上传", `上传或更新了 ${wellNo} 的井史 PDF`);
    await fetchWellHistoryPdf(wellNo);
  } catch (error) {
    addNotification("上传失败", `${wellNo} 井史 PDF 上传失败`, "error");
  } finally {
    setUploadingPdf(false);
  }
};
```

- [ ] **Step 4: Replace the placeholder visual area with a PDF viewer**

Update the main content area to render:

```tsx
{pdfLoading ? (
  <div className="h-[720px] flex items-center justify-center text-sm text-gray-500">井史 PDF 加载中...</div>
) : pdfRecord ? (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-table-border bg-[#f7f9fc] px-4 py-3 text-xs text-gray-600">
      <div>{`井号：${pdfRecord.wellNo}`}</div>
      <div>{`文件：${pdfRecord.originalName}`}</div>
      <div>{`更新时间：${new Date(pdfRecord.updatedAt).toLocaleString()}`}</div>
    </div>
    <iframe
      key={pdfRecord.fileUrl}
      src={pdfRecord.fileUrl}
      title={`${pdfRecord.wellNo} 井史 PDF`}
      className="h-[720px] w-full rounded-xl border border-gray-200"
    />
  </div>
) : (
  <div className="h-[720px] flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
    <div className="mb-2">该井暂无井史 PDF</div>
    <div>请在当前页面上传后查看</div>
  </div>
)}
```

- [ ] **Step 5: Add in-page upload/update controls**

In the search/action bar, add:

```tsx
{(hasPermission("add") || hasPermission("modify")) && (
  <>
    <input
      ref={pdfInputRef}
      type="file"
      accept="application/pdf"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void handleUploadPdf(file);
        e.currentTarget.value = "";
      }}
    />
    <button
      onClick={() => pdfInputRef.current?.click()}
      disabled={uploadingPdf || !wellNo.trim()}
      className="px-6 py-2 bg-cnpc-blue text-white rounded-lg text-sm font-bold disabled:opacity-50"
    >
      {uploadingPdf ? "上传中..." : pdfRecord ? "更新 PDF" : "上传 PDF"}
    </button>
  </>
)}
```

- [ ] **Step 6: Make query button load the selected well PDF**

Use:

```tsx
<button
  onClick={() => void fetchWellHistoryPdf(wellNo.trim())}
  className="px-6 py-2 bg-cnpc-red text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
>
  查询井史
</button>
```

- [ ] **Step 7: Run typecheck and smoke-test the page**

Run:

```powershell
npm run lint
```

Expected:

```text
No new TypeScript errors from WellHistoryPage additions
```

Manual smoke test:

```text
1. 打开 http://127.0.0.1:5000/
2. 进入“单井井史”
3. 输入井号并查询
4. 上传 C:\Users\31541\Desktop\0510ZS\B\牛心坨井史-蒙更新.pdf
5. 确认页面自动显示 PDF
6. 再次上传同井号 PDF，确认页面自动切换到最新版本
```

- [ ] **Step 8: Commit the frontend work**

```bash
git add src/App.tsx
git commit -m "feat: add well history pdf viewer"
```

### Task 4: Document the New Workflow

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\README.md`

- [ ] **Step 1: Add a short section describing well-history PDF upload**

Add a section such as:

```md
## 单井井史 PDF

- `单井井史` 页面支持按井号查询井史 PDF
- 支持在页面内直接上传或替换更新 PDF
- 一个井号绑定一份当前有效 PDF
- PDF 文件保存在本地 `uploads/well-history/` 目录，元数据保存在数据库
```

- [ ] **Step 2: Run a quick README sanity check**

Run:

```powershell
rg -n "单井井史 PDF|uploads/well-history" README.md
```

Expected:

```text
New documentation lines are present
```

- [ ] **Step 3: Commit the README update**

```bash
git add README.md
git commit -m "docs: document well history pdf workflow"
```

## Self-Review

### Spec coverage

- 按井号查询 PDF: covered by Task 2 lookup API and Task 3 query flow.
- 页面内上传/更新: covered by Task 2 upload API and Task 3 in-page upload controls.
- 一井一份当前有效 PDF: covered by Task 1 unique `wellNo` and Task 2 update logic.
- 上传后自动显示: covered by Task 3 `handleUploadPdf` -> `fetchWellHistoryPdf`.
- 后续可继续维护更新: covered by replacement behavior and persistent metadata model.

### Placeholder scan

- No `TODO` or `TBD`.
- Commands, code targets, and file paths are explicit.

### Type consistency

- Backend and frontend both use `wellNo`.
- Persistence model and API both use `fileUrl`, `storedFileName`, `originalName`, `mimeType`, `size`, `remark`.

