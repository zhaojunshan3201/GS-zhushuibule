# Well History Archive And Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `单井井史` from a per-well PDF viewer into a maintainable well archive page with fuzzy well lookup, current-archive display, and basic PDF text extraction persistence.

**Architecture:** Keep raw PDFs on disk, add an archive master record keyed by `wellNo`, and add an extraction record that stores machine-readable text derived from the current PDF. Extend the existing upload flow so one upload updates the PDF record, syncs the archive, and refreshes extracted content. Rebuild the frontend page around search, archive selection, metadata display, extracted text, and raw PDF preview.

**Tech Stack:** React 19, Axios, Fuse.js, Express, Prisma, PostgreSQL, local file uploads, Python `pypdf` via child process for basic PDF text extraction

---

## File Structure

- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\prisma\schema.prisma`
  - Add `WellHistoryArchive` and `WellHistoryExtract` models plus relations to `WellHistoryPdf`.
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\server.ts`
  - Add archive sync logic, fuzzy archive search/detail APIs, and basic PDF text extraction.
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`
  - Replace the page’s single-file query UX with archive search, suggestion list, metadata cards, extracted text, and PDF preview.
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\README.md`
  - Document the archive workflow and extraction behavior.

### Task 1: Add Archive And Extraction Persistence

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\prisma\schema.prisma`

- [ ] **Step 1: Add `WellHistoryArchive` and `WellHistoryExtract` models**

Add models that let one well keep a current archive record and one current extracted text record.

- [ ] **Step 2: Link `WellHistoryPdf` to the archive and extract models**

Keep `WellHistoryPdf` as the file metadata table but add relational fields for archive/extract lookups.

- [ ] **Step 3: Push the schema**

Run:

```powershell
npx prisma validate
npx prisma generate --no-engine
npx prisma db push
```

Expected:

```text
The schema at prisma\schema.prisma is valid
Generated Prisma Client
Your database is now in sync with your Prisma schema
```

### Task 2: Extend The Backend To Maintain Well Archives

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\server.ts`

- [ ] **Step 1: Add helper types and Python PDF extraction support**

Add a small helper that shells out to Python `pypdf` to read raw text from uploaded PDFs and normalize a short summary.

- [ ] **Step 2: Add archive sync logic into the upload endpoint**

After the PDF record is created or updated:

- create the `WellHistoryArchive` record when it does not exist
- update `currentPdfId`, `unit`, `block`, `displayName`, and `updatedAt` when it does
- refresh a `WellHistoryExtract` row for the current PDF

- [ ] **Step 3: Add fuzzy search and detail APIs**

Add:

- `GET /api/well-history-archives/search`
- `GET /api/well-history-archives/:wellNo`

The search API should accept `keyword`, `unit`, and `block` and return lightweight candidates ordered by update time. The detail API should return archive metadata plus the current PDF and extract records.

- [ ] **Step 4: Preserve existing upload behavior**

Keep the current `/api/uploads/well-history-pdf` endpoint shape so the frontend upload call does not have to change form structure.

### Task 3: Rebuild The Frontend As A Well Archive Page

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`

- [ ] **Step 1: Add archive and extraction frontend types**

Add interfaces for:

- `WellHistoryArchiveSummary`
- `WellHistoryArchiveDetail`
- `WellHistoryExtractRecord`

- [ ] **Step 2: Replace single-record query state with archive search state**

Add state for:

- keyword input
- fuzzy candidate list
- active selected well
- loading states for search/detail/upload

- [ ] **Step 3: Fetch archive candidates while typing**

Trigger archive search when the user enters a keyword and show a result list directly under the well input.

- [ ] **Step 4: Load archive detail after selecting a candidate**

When a user selects a candidate or clicks query:

- load the archive detail
- show the archive metadata card
- show extracted text blocks
- show the raw PDF preview

- [ ] **Step 5: Keep upload and update inside the page**

Reuse the existing upload action, but after upload:

- refresh the current archive detail
- refresh the search candidate list if needed

- [ ] **Step 6: Improve the visual structure into a real archive page**

Render:

- a compact query/search toolbar
- a well archive summary card
- an extracted-text section
- a raw PDF preview section

### Task 4: Document The Archive Workflow

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\README.md`

- [ ] **Step 1: Update the `单井井史` documentation**

Document:

- fuzzy well search
- per-well archive storage
- upload/update behavior
- extracted text persistence

### Task 5: Verify The End-To-End Flow

**Files:**
- No source changes required

- [ ] **Step 1: Run verification commands**

Run:

```powershell
npx prisma validate
npx prisma generate --no-engine
npm run lint
```

Expected:

- Prisma commands pass
- `npm run lint` may still show the known unrelated repo errors, but no new errors from archive/extraction work

- [ ] **Step 2: Smoke-test upload, archive lookup, and replacement**

Use the existing sample file:

`C:\Users\31541\Desktop\0510ZS\B\牛心坨井史-蒙更新.pdf`

Verify:

1. upload creates or updates the archive for one well
2. search returns that well by partial keyword
3. detail API returns archive + PDF + extract data
4. page shows extracted text and raw PDF
5. re-upload updates the current record

## Self-Review

### Spec coverage

- 第一阶段单井档案: covered by Tasks 1, 2, and 3.
- 井号模糊查询: covered by Task 2 search API and Task 3 search UX.
- 页面内上传更新: covered by existing upload reuse in Task 2 and Task 3.
- 第二阶段基础识别结果: covered by Task 2 extraction helper and Task 3 extracted-text section.

### Placeholder scan

- No `TODO` or `TBD`.
- The implementation order is explicit and mapped to concrete files.

### Type consistency

- `WellHistoryPdf` remains file metadata.
- `WellHistoryArchive` is the master per-well record.
- `WellHistoryExtract` stores extracted text derived from the current PDF.

