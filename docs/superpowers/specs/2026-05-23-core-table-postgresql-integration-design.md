# Core Table PostgreSQL Integration Design

## Goal

Move the first batch of core table pages from frontend mock/cache data to PostgreSQL-backed data so add, delete, filter, and pagination behavior is real and persistent.

## Scope

This first batch includes:

- 含水化验
- 注水工艺
- 水井洗井
- 异常水井
- 动态调配

This batch explicitly excludes the more complex second-batch pages:

- 同心测调井史
- 智能测调井史
- 单井注入评价
- 单井密封评价
- 分注指标汇总
- 动态分析对比表

## Current State

The project already uses PostgreSQL through Prisma. `DynamicAdjustmentRecord` already has database CRUD APIs, but the frontend falls back to local mock rows when the database returns no records. Several other first-batch pages still render static arrays in `src/App.tsx` and perform filtering or pagination in the browser.

Existing useful backend pieces:

- `WaterCutRecord` model exists but does not yet match the current page's full table behavior.
- `DynamicAdjustmentRecord` model and API exist and should be retained.
- The Express API is centralized in `server.ts`.
- Prisma schema is in `prisma/schema.prisma`.

## Recommended Architecture

Use one Prisma-backed main table per core page. Store frequently filtered fields as typed columns and store small repeated display groups as JSON only where a normalized child table would be unnecessary for this first batch.

This is more maintainable than a generic JSON table and simpler than fully normalized domain modeling for every repeated table group.

## Data Model

### WaterCutRecord

Reuse the existing `WaterCutRecord` intent, but make it support the table directly:

- `id`
- `unit`
- `block`
- `wellNo`
- `sampleDate`
- `waterCut`
- `tester`
- `remark`
- timestamps

Filtering fields:

- `unit`
- `block`
- `wellNo`
- water-cut range
- optional sample-date range

### InjectionTechRecord

Add a table for 注水工艺:

- `id`
- `wellNo`
- `block`
- `workArea`
- `process`
- `packerCount`
- `packerModels` as JSON array of six strings
- `bottomStructure`
- `washable`
- `doublePacker`
- `washReminder`
- `lastWorkDate`
- `runningDate`
- timestamps

Filtering fields:

- `workArea`
- `block`
- `process`
- `packerCount`
- `bottomStructure`
- `wellNo`

### WellFlushingRecord

Add a table for 水井洗井:

- `id`
- `unit`
- `wellNo`
- `washDate`
- `daysSinceLastWash`
- `method`
- `equipmentPressure`
- `duration`
- `totalWater`
- `firstLevel` as JSON array of five strings or numbers
- `secondLevel` as JSON array of five strings or numbers
- `suspendedMatter` as JSON array of three strings or numbers
- `remark`
- timestamps

Filtering fields:

- `unit`
- `wellNo`
- `washDate` range

### AbnormalWellRecord

Add a table for 异常水井:

- `id`
- `category`
- `wellNo`
- `block`
- `unit`
- `process`
- `normalDaily`
- `normalOilPressure`
- `normalCasingPressure`
- `normalLayerPressure`
- `abnormalDaily`
- `abnormalOilPressure`
- `abnormalCasingPressure`
- `abnormalLayerPressure`
- `suggestion`
- timestamps

Filtering fields:

- `unit`
- `block`
- `wellNo`
- `category`
- `process`

### DynamicAdjustmentRecord

Keep the existing Prisma model and API. Remove the frontend mock fallback and seed representative data into PostgreSQL instead.

## API Design

Each first-batch page gets database-backed APIs with the same shape:

- `GET /api/<resource>` returns `{ rows, total, page, pageSize }`
- `POST /api/<resource>` creates a row
- `DELETE /api/<resource>/:id` deletes a row

Dynamic adjustment may keep returning an array for compatibility if changing the response shape would increase risk. Other new endpoints should use the paginated response shape.

Resource names:

- `/api/water-cuts`
- `/api/injection-tech-records`
- `/api/well-flushing-records`
- `/api/abnormal-well-records`
- `/api/dynamic-adjustments`

Filters should be implemented in Prisma `where`, not by filtering page arrays in React. Pagination should use `skip` and `take`.

## Seeding Existing Mock Data

Move the current first-batch mock rows out of the active page render path and into a repeatable seed/init path.

Acceptable implementation:

- Create a local seed helper in `server.ts` or a focused script.
- Insert seed rows only when the target table is empty.
- Preserve the displayed values from the current page arrays.

After this change, an empty table should render an empty state, not a frontend mock fallback.

## Frontend Design

Keep the current visual layout. Change data ownership only.

Each page should:

- Hold filters as controlled React state.
- Fetch rows from its API on load and when the user clicks 确定.
- Send `page` and `pageSize` to the API.
- Render `total` from the API.
- Add a small create form or modal sufficient to insert rows for that page.
- Delete selected or row-level records through the API.
- Show loading and error states using the existing compact page style.
- Show 暂无数据 when the API returns no rows.

Do not introduce a new UI framework or large state-management layer.

## Error Handling

Backend:

- Validate required fields before create.
- Return `400` for invalid request data.
- Return `404` when deleting a missing record.
- Return `500` with a concise error message for unexpected failures.

Frontend:

- Disable save buttons while saving.
- Show API error text near the toolbar or form.
- Refresh the table after successful create/delete.

## Testing

Add focused tests around backend behavior first:

- Water-cut filtering and pagination uses database query behavior.
- Injection-tech create/delete persists.
- Well-flushing date range filter works.
- Abnormal-well filtering by category and well number works.
- Dynamic-adjustment no longer relies on mock fallback in the frontend logic.

Run:

- `npm test`
- `npm run lint`

If Prisma migration or local database availability blocks automated tests, document the blocker and verify with a local API smoke test after migration.

## Success Criteria

- First-batch pages no longer read active table rows from frontend mock arrays.
- Add, delete, filter, and pagination for first-batch pages go through PostgreSQL.
- Refreshing the browser preserves newly added records.
- Deleted records do not reappear after refresh.
- Database-empty pages show a real empty state.
- Second-batch pages remain unchanged.
