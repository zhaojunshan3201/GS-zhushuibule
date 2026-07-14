# 单井井史 FG4 完整迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 FG4 的单井井史 PPTX 与富文本能力、持久化、接口和测试定向合并到当前系统。

**Architecture:** 保持 PDF 档案及既有接口不变，在 `WellHistoryArchive` 上新增可空的 PPTX 和富文本关联。前端由独立编辑组件调用井号 API；服务端负责版本、文件和级联清理。

**Tech Stack:** React、TypeScript、Express、Prisma、JSZip、fast-xml-parser、sanitize-html、Node test runner。

---

## 文件结构

| 路径 | 职责 |
| --- | --- |
| `src/shared/pptxWellHistory.ts` | PPTX OOXML 读取、编辑、写回。 |
| `src/shared/wellHistoryRichText.ts` | 富文本清洗、图片 URL 收集和 PPT 页面 HTML。 |
| `src/components/PptxWellHistoryEditor.tsx` | PPTX 编辑、版本保存和下载。 |
| `src/components/WellHistoryRichTextEditor.tsx` | 富文本编辑区域。 |
| `src/App.tsx` | 单井井史页面的目录、详情和编辑器集成。 |
| `server.ts` | PPTX、富文本版本和文件清理 API。 |
| `prisma/schema.prisma` 与两份新迁移 | PPTX、富文本及版本的数据模型。 |
| `tests/pptxWellHistory.test.ts` | PPTX 和服务端校验回归测试。 |
| `tests/wellHistoryRichText.test.ts` | 富文本安全与页面导出测试。 |

### Task 1: 建立失败测试基线和依赖

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `tests/pptxWellHistory.test.ts`, `tests/wellHistoryRichText.test.ts`

- [ ] **Step 1: 复制 FG4 测试。**

```powershell
$source = 'C:\Users\31541\Desktop\7.6\FG4\gszhushuiSQL'
Copy-Item "$source\tests\pptxWellHistory.test.ts" 'tests\pptxWellHistory.test.ts'
Copy-Item "$source\tests\wellHistoryRichText.test.ts" 'tests\wellHistoryRichText.test.ts'
```

- [ ] **Step 2: 运行测试确认红灯。**

```powershell
npm test -- tests/pptxWellHistory.test.ts tests/wellHistoryRichText.test.ts
```

Expected: 因缺少 `pptxWellHistory`、`wellHistoryRichText` 或服务端导出失败，不能是测试命令错误。

- [ ] **Step 3: 安装 FG4 的模块依赖并对齐测试脚本。**

```powershell
npm install jszip fast-xml-parser sanitize-html
npm install -D @types/sanitize-html cross-env
```

将 `package.json` 的测试脚本更新为：

```json
"test": "cross-env NODE_ENV=test tsx --test tests/**/*.test.ts"
```

- [ ] **Step 4: 提交。**

```powershell
git add package.json package-lock.json tests/pptxWellHistory.test.ts tests/wellHistoryRichText.test.ts
git commit -m "test: add well history migration coverage"
```

### Task 2: 迁移共享 PPTX 与富文本模块

**Files:**
- Create: `src/shared/pptxWellHistory.ts`, `src/shared/wellHistoryRichText.ts`
- Test: `tests/pptxWellHistory.test.ts`, `tests/wellHistoryRichText.test.ts`

- [ ] **Step 1: 逐一运行两份测试确认模块导入失败。**

```powershell
npm test -- tests/pptxWellHistory.test.ts
npm test -- tests/wellHistoryRichText.test.ts
```

- [ ] **Step 2: 原样迁移两个无 UI 的共享模块。**

```powershell
$source = 'C:\Users\31541\Desktop\7.6\FG4\gszhushuiSQL'
Copy-Item "$source\src\shared\pptxWellHistory.ts" 'src\shared\pptxWellHistory.ts'
Copy-Item "$source\src\shared\wellHistoryRichText.ts" 'src\shared\wellHistoryRichText.ts'
```

其中 `applyPptxEdit` 必须支持文本替换、页面增删和排序，且不删最后一页；PPTX 写回必须保留图片、主题和未支持 XML。富文本清洗只接受 `/uploads/well-history/` 图片，移除脚本、事件属性与 `javascript:` URL。

- [ ] **Step 3: 重新运行两份测试。**

```powershell
npm test -- tests/pptxWellHistory.test.ts tests/wellHistoryRichText.test.ts
```

Expected: 共享模块断言通过，剩余失败仅是未迁移的服务端导出。

- [ ] **Step 4: 提交。**

```powershell
git add src/shared/pptxWellHistory.ts src/shared/wellHistoryRichText.ts
git commit -m "feat: add well history shared document tools"
```

### Task 3: 增加数据库模型与迁移

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/202607120001_add_well_history_pptx_versions/migration.sql`
- Create: `prisma/migrations/202607120002_add_well_history_rich_text/migration.sql`

- [ ] **Step 1: 复制两份独立迁移。**

```powershell
$source = 'C:\Users\31541\Desktop\7.6\FG4\gszhushuiSQL'
Copy-Item "$source\prisma\migrations\202607120001_add_well_history_pptx_versions" 'prisma\migrations\202607120001_add_well_history_pptx_versions' -Recurse
Copy-Item "$source\prisma\migrations\202607120002_add_well_history_rich_text" 'prisma\migrations\202607120002_add_well_history_rich_text' -Recurse
```

- [ ] **Step 2: 从 FG4 定向合并 schema 的四个模型与档案关联。**

```powershell
$source = 'C:\Users\31541\Desktop\7.6\FG4\gszhushuiSQL'
git diff --no-index -- prisma\schema.prisma "$source\prisma\schema.prisma"
```

必须增加 `WellHistoryPptx`、`WellHistoryPptxVersion`、`WellHistoryRichTextDocument`、`WellHistoryRichTextVersion`；`WellHistoryArchive.currentPptxId` 与新增关联须可空，以兼容已有 PDF 档案。

- [ ] **Step 3: 生成 Prisma Client。**

```powershell
npx prisma generate
```

Expected: exit code 0，client 具有四个新增模型访问器。

- [ ] **Step 4: 提交。**

```powershell
git add prisma/schema.prisma prisma/migrations/202607120001_add_well_history_pptx_versions prisma/migrations/202607120002_add_well_history_rich_text
git commit -m "feat: add well history document schema"
```

### Task 4: 合并服务端 API 和文件处理

**Files:**
- Modify: `server.ts`
- Test: `tests/pptxWellHistory.test.ts`, `tests/wellHistoryRichText.test.ts`

- [ ] **Step 1: 确认服务端导出仍为失败原因。**

```powershell
npm test -- tests/pptxWellHistory.test.ts tests/wellHistoryRichText.test.ts
```

- [ ] **Step 2: 使用差异文件作锚点，只合并井史代码。**

```powershell
$source = 'C:\Users\31541\Desktop\7.6\FG4\gszhushuiSQL'
git diff --no-index -- server.ts "$source\server.ts" | Out-File "$env:TEMP\well-history-server.diff" -Encoding utf8
```

迁移 `soffice` PPT 转 PPTX、PPT 页面 PNG 导出、文件大小/扩展名校验、乐观版本检查、PPTX 当前件及版本持久化、富文本读取保存、档案详情字段和删除级联清理。不得替换非井史路由。

- [ ] **Step 3: 注册并核对 API。**

```text
GET  /api/well-history-archives/:wellNo/pptx
GET  /api/well-history-archives/:wellNo/pptx/versions
POST /api/well-history-archives/:wellNo/pptx/versions
GET  /api/well-history-archives/:wellNo/pptx/download
GET  /api/well-history-archives/:wellNo/document
PUT  /api/well-history-archives/:wellNo/document
```

- [ ] **Step 4: 运行回归测试。**

```powershell
npm test -- tests/pptxWellHistory.test.ts tests/wellHistoryRichText.test.ts tests/wellHistoryImport.test.ts
```

Expected: exit code 0；转换错误分类、上传限制、版本冲突、文件清理与 PPT 页面自然排序均通过。

- [ ] **Step 5: 提交。**

```powershell
git add server.ts tests/pptxWellHistory.test.ts tests/wellHistoryRichText.test.ts
git commit -m "feat: add well history document APIs"
```

### Task 5: 合并前端编辑组件与页面

**Files:**
- Create: `src/components/PptxWellHistoryEditor.tsx`, `src/components/WellHistoryRichTextEditor.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 复制独立编辑器组件。**

```powershell
$source = 'C:\Users\31541\Desktop\7.6\FG4\gszhushuiSQL'
Copy-Item "$source\src\components\PptxWellHistoryEditor.tsx" 'src\components\PptxWellHistoryEditor.tsx'
Copy-Item "$source\src\components\WellHistoryRichTextEditor.tsx" 'src\components\WellHistoryRichTextEditor.tsx'
```

- [ ] **Step 2: 以差异为依据定向合并 `WellHistoryPage`。**

```powershell
$source = 'C:\Users\31541\Desktop\7.6\FG4\gszhushuiSQL'
git diff --no-index -- src\App.tsx "$source\src\App.tsx" | Out-File "$env:TEMP\well-history-app.diff" -Encoding utf8
```

保留当前 PDF 浏览、叠加编辑、上传、批量导入、检索、删除；添加 PPTX 编辑、下载、版本列表、富文本编辑和保存。顶栏保存必须调用当前活动编辑器注册的保存处理器。

- [ ] **Step 3: 类型检查。**

```powershell
npm run lint
```

Expected: exit code 0；仅修复井史迁移引入的类型错误。

- [ ] **Step 4: 提交。**

```powershell
git add src/App.tsx src/components/PptxWellHistoryEditor.tsx src/components/WellHistoryRichTextEditor.tsx
git commit -m "feat: add well history document editors"
```

### Task 6: 完整验证

**Files:**
- Verify: `prisma/schema.prisma`, `server.ts`, `src/App.tsx`, `tests/pptxWellHistory.test.ts`, `tests/wellHistoryRichText.test.ts`

- [ ] **Step 1: 检查迁移是非破坏性的。**

```powershell
Select-String -Path 'prisma\migrations\202607120001_add_well_history_pptx_versions\migration.sql','prisma\migrations\202607120002_add_well_history_rich_text\migration.sql' -Pattern 'DROP TABLE|DELETE FROM|NOT NULL'
```

Expected: 不匹配 `DROP TABLE`、`DELETE FROM` 或要求旧档案回填的 `NOT NULL`。

- [ ] **Step 2: 运行完整自动化验证。**

```powershell
npm test
npm run lint
npm run build
```

Expected: 三条命令均 exit code 0。

- [ ] **Step 3: 手工核对功能。**

```text
打开旧 PDF 档案并验证检索、PDF 编辑、删除仍可用；导入 PPTX 后编辑文字、增删排序页面、保存版本并下载；编辑富文本并刷新确认保存；删除含 PPTX/富文本的档案并确认关联文件和记录清理。
```

- [ ] **Step 4: 提交最终变更。**

```powershell
git add package.json package-lock.json prisma/schema.prisma prisma/migrations/202607120001_add_well_history_pptx_versions prisma/migrations/202607120002_add_well_history_rich_text server.ts src/App.tsx src/components/PptxWellHistoryEditor.tsx src/components/WellHistoryRichTextEditor.tsx src/shared/pptxWellHistory.ts src/shared/wellHistoryRichText.ts tests/pptxWellHistory.test.ts tests/wellHistoryRichText.test.ts
git commit -m "feat: migrate FG4 well history capabilities"
```

## 自检

- PPTX、富文本、接口、数据库、依赖、测试、删除级联和旧档案兼容均有对应任务。
- 生产代码均在相应失败测试之后引入。
- 迁移范围限定于单井井史，不包含 FG4 的无关页面或服务端改动。
