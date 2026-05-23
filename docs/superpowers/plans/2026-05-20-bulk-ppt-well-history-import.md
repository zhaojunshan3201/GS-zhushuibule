# Bulk PPT Well History Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add batch folder-based PPT/PPTX import for `单井井史`, where each file represents one well, file names map to `wellNo`, each PPT/PPTX is converted to PDF, and the result is stored into the existing per-well archive flow.

**Architecture:** Reuse the existing well-history archive pipeline instead of creating a parallel PPT system. Accept multiple PPT/PPTX files in one request, store the original source files under a separate upload directory, convert each file to PDF, then push the generated PDF through the same archive sync logic that currently powers PDF uploads. The frontend adds a folder-based batch import entry and shows a success/failure result list.

**Tech Stack:** React 19, Axios, Express, Prisma, PostgreSQL, local uploads, PowerPoint-to-PDF conversion via local automation or office-capable command path, existing well-history archive system

---

## File Structure

- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\server.ts`
  - Add source-file storage, batch PPT upload endpoint, file-name parsing, and conversion orchestration.
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`
  - Add the folder-upload action, result reporting UI, and archive refresh behavior.
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\README.md`
  - Document the new batch PPT import workflow.

### Task 1: Add Source-PPT Batch Import Backend

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\server.ts`

- [ ] **Step 1: Add a source-file upload directory**

Create a dedicated directory such as:

- `uploads/well-history-source/`

This keeps raw `ppt/pptx` files separate from converted PDF outputs.

- [ ] **Step 2: Add helper functions**

Add helpers for:

- checking ppt/pptx extension
- deriving `wellNo` from filename
- rejecting duplicates inside one batch
- writing source files to disk

- [ ] **Step 3: Add a batch upload endpoint**

Add:

- `POST /api/uploads/well-history-ppt-batch`

The route should:

- accept multiple `files`
- read `unit`, `block`, `remark`
- process each file independently
- return a batch result summary

- [ ] **Step 4: Convert each PPT/PPTX to PDF**

For each file:

- store the source file
- convert it to a PDF
- pass the generated PDF into the existing well-history archive sync flow

- [ ] **Step 5: Return a per-file result list**

Include:

- `fileName`
- `wellNo`
- `status`
- `message`
- `pdfUrl` when successful

### Task 2: Reuse Existing Archive Sync

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\server.ts`

- [ ] **Step 1: Extract shared “save PDF into archive” logic**

Refactor the current single-PDF upload path so both:

- manual PDF upload
- converted PPT-generated PDF

can use the same internal save-and-sync function.

- [ ] **Step 2: Ensure converted PDFs update all archive tables**

Converted files must still update:

- `WellHistoryPdf`
- `WellHistoryArchive`
- `WellHistoryExtract`

- [ ] **Step 3: Keep overwrite semantics by `wellNo`**

If the same well is imported again:

- replace the current effective PDF
- update archive metadata
- refresh extracted content

### Task 3: Add Frontend Folder Import UX

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\src\App.tsx`

- [ ] **Step 1: Add a folder-import trigger**

In the `单井井史` page action area, add:

- `批量导入PPT`

- [ ] **Step 2: Support directory selection**

Use a file input configured for directory selection so the user can choose one folder containing many `ppt/pptx` files.

- [ ] **Step 3: Upload all selected files in one batch**

Build a `FormData` payload with:

- `files[]`
- `unit`
- `block`
- `remark`

- [ ] **Step 4: Show import results**

Render a result area with:

- success count
- failure count
- per-file result rows

- [ ] **Step 5: Refresh archive lookup after successful import**

After a successful batch:

- allow the imported wells to appear in fuzzy search
- optionally auto-load the first successful well

### Task 4: Document The New Workflow

**Files:**
- Modify: `C:\Users\31541\Desktop\0510ZS\B\gszhushuiSQL\gszhushuiSQL\README.md`

- [ ] **Step 1: Add a batch PPT import section**

Document:

- one well per ppt/pptx
- filename equals well number
- upload a whole folder
- automatic PDF conversion
- archive auto-generation

### Task 5: Verify The Flow

**Files:**
- No source changes required

- [ ] **Step 1: Run validation commands**

Run:

```powershell
npx prisma validate
npx prisma generate --no-engine
npm run lint
```

Expected:

- Prisma commands pass
- `npm run lint` may still show known unrelated repo errors, but no new errors from the PPT import feature

- [ ] **Step 2: Smoke-test batch import**

Verify:

1. choose a folder with multiple ppt/pptx files
2. each valid file becomes one well archive candidate
3. converted PDF files are generated
4. imported wells can be found by fuzzy search
5. failures show up in the result list without breaking the rest of the batch

## Self-Review

### Spec coverage

- one well per ppt/pptx: covered by filename-to-wellNo mapping in Tasks 1 and 2.
- upload folder contents: covered by Task 3.
- auto convert to PDF: covered by Task 1 and Task 2.
- reuse existing per-well archive system: covered by Task 2.
- show import results and preserve failures: covered by Task 3 and Task 5.

### Placeholder scan

- No `TODO` or `TBD`.
- The files and behavior are explicit.

### Type consistency

- Batch import remains a new source path into the same `WellHistoryPdf` / `WellHistoryArchive` / `WellHistoryExtract` model chain.

