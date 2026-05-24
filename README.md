# 注水管理平台

高升采油厂注水管理平台的本地开发版本。项目采用 `React + Vite + Express + Prisma + PostgreSQL`，支持在本地或局域网环境中运行，并可按需对接内网 Oracle 数据源。

当前版本已经把主要业务表从前端模拟数据迁移到 PostgreSQL。页面的查询、筛选、新增、删除通过后端接口读写数据库，不再依赖页面本地缓存作为数据源。

## 技术栈

- 前端：`React 19`、`Vite`、`Tailwind CSS`
- 后端：`Node.js`、`Express`
- ORM：`Prisma`
- 主数据库：`PostgreSQL`
- 外部数据源：`Oracle`，可选配置

## 已接入 PostgreSQL 的页面

第一批核心页面：

- 含水化验
- 注水工艺
- 水井洗井
- 异常水井
- 动态调配

第二批复杂表页面：

- 同心测调井史
- 智能测调井史
- 单井注入评价
- 单井密封评价
- 分注指标汇总
- 动态分析对比

这些页面的当前模拟展示数据已经通过 `/api/seed` 写入 PostgreSQL。后续开发时，可以直接基于数据库数据继续扩展字段、校验、导入导出和业务流程。

## 水井洗井页面

`水井洗井统计列表` 使用后端 `WellFlushingRecord` 表作为数据源，页面默认每页显示 15 条记录，并支持按单位、井号、洗井日期阶段筛选。

页面提供单条新增、删除、Excel 导入和模板下载。Excel 导入会先由前端读取工作表内容，再提交到 `/api/well-flushing-records/import` 批量写入 PostgreSQL，便于后续统计、查询和其它业务页面复用数据。

## 单井井史页面

`单井井史` 支持 PPT/PPTX 批量导入。导入时后端会先按文件名识别井号，将 PPT 转为 PDF，再保存为该井号当前井史档案。

同一个 PPT 文件内的多页会保留为多页 PDF。同一批次内如果上传同一井号的多个 PPT，例如 `GS-101-1.pptx`、`GS-101-2.pptx`，系统会按序号或上传顺序合并为一个多页 PDF，并以一条当前档案记录保存到数据库。PDF 文件本体保存在 `uploads/well-history/`，数据库保存目录、PDF 路径、提取文本和编辑覆盖层数据。

## 数据库与迁移

Prisma schema 位于：

```text
prisma/schema.prisma
```

已包含两批业务表迁移：

```text
prisma/migrations/202605230001_core_table_records/
prisma/migrations/202605230002_second_batch_records/
```

第一批主要表：

- `WaterCutRecord`
- `InjectionTechRecord`
- `WellFlushingRecord`
- `AbnormalWellRecord`
- `DynamicAdjustmentRecord`

第二批主要表：

- `ConcentricTestRecord`
- `SmartTestRecord`
- `SingleWellInjectionEvaluationRecord`
- `SingleWellSealEvaluationRecord`
- `ZonalIndicatorSummaryRecord`
- `DynamicAnalysisRecord`

复杂分层字段和跨列统计字段使用 PostgreSQL `JSONB` 保存，例如各层测调自由度、分层日注水量、内外压、封隔器统计、动态分析对比值和处理意见。

## 后端接口

第一批接口：

```text
GET    /api/water-cuts
POST   /api/water-cuts
DELETE /api/water-cuts/:id

GET    /api/injection-tech-records
POST   /api/injection-tech-records
DELETE /api/injection-tech-records/:id

GET    /api/well-flushing-records
POST   /api/well-flushing-records
POST   /api/well-flushing-records/import
DELETE /api/well-flushing-records/:id

GET    /api/abnormal-well-records
POST   /api/abnormal-well-records
DELETE /api/abnormal-well-records/:id

GET    /api/dynamic-adjustments
POST   /api/dynamic-adjustments
PUT    /api/dynamic-adjustments/:id
DELETE /api/dynamic-adjustments/:id
```

第二批接口：

```text
GET    /api/concentric-test-records
POST   /api/concentric-test-records
DELETE /api/concentric-test-records/:id

GET    /api/smart-test-records
POST   /api/smart-test-records
DELETE /api/smart-test-records/:id

GET    /api/single-well-injection-evaluations
POST   /api/single-well-injection-evaluations
DELETE /api/single-well-injection-evaluations/:id

GET    /api/single-well-seal-evaluations
POST   /api/single-well-seal-evaluations
DELETE /api/single-well-seal-evaluations/:id

GET    /api/zonal-indicator-summaries
POST   /api/zonal-indicator-summaries
DELETE /api/zonal-indicator-summaries/:id

GET    /api/dynamic-analysis-records
POST   /api/dynamic-analysis-records
DELETE /api/dynamic-analysis-records/:id
```

分页类列表统一返回：

```json
{
  "rows": [],
  "total": 0,
  "page": 1,
  "pageSize": 15
}
```

## 本地开发

### Windows 局域网一键启动

双击项目根目录的批处理文件：

```text
start-lan.bat
```

该脚本会检查 Node/npm、自动安装缺失依赖、生成 Prisma Client，并启动到 `0.0.0.0:5000`。启动窗口会显示本机访问地址和局域网访问地址。内网 Oracle 暂时不可用时，`ORACLE_*` 配置可以留空，系统会使用 PostgreSQL 中已有的最新缓存数据。

### 1. 安装依赖

```powershell
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env`：

```env
DATABASE_URL="postgresql://用户名:密码@localhost:5432/water_injection_db"
```

如果本机需要连接 Oracle，再补充 Oracle 相关配置。只做页面和 PostgreSQL 接口开发时，可以不配置 Oracle。

### 3. 初始化 Prisma

```powershell
npx prisma generate
npx prisma migrate deploy
```

### 4. 启动项目

```powershell
npm run dev
```

默认访问地址：

```text
http://localhost:5000/
```

## 初始化数据

首次部署或清空数据库后，访问：

```text
http://localhost:5000/api/seed
```

该接口会写入默认管理员、系统配置、第一批核心页面数据和第二批复杂表页面数据。

默认管理员：

- 工号：`GS001`
- 密码：`admin666`

## 常用命令

```powershell
npm run dev
npm test
npm run lint
npx prisma validate
npx prisma generate
npx prisma migrate deploy
```

说明：

- `npm run dev`：启动本地开发服务
- `npm test`：运行 Node 测试
- `npm run lint`：执行 TypeScript 类型检查
- `npx prisma validate`：校验 Prisma schema
- `npx prisma generate`：生成 Prisma Client
- `npx prisma migrate deploy`：应用数据库迁移

## 验证状态

最近一次数据库打通验证包含：

- `npx prisma validate` 通过
- `npx prisma generate` 通过
- `npx prisma migrate deploy` 通过
- `npm test` 通过，13 个测试全部通过
- `npm run lint` 通过
- 第一批和第二批接口查询、筛选、新增、删除冒烟通过
- 浏览器打开 `http://localhost:5000` 后，相关页面均能加载 PostgreSQL 数据

## 目录说明

```text
src/                 前端页面、组件和共享工具
src/shared/          前后端复用的数据构造、筛选和规范化逻辑
server.ts            Express 服务入口
prisma/              Prisma schema 和数据库迁移
tests/               Node 测试
docs/                设计文档和实施计划
uploads/             本地上传文件
```

## 注意事项

- 当前目录不是 git 仓库，代码变更不会自动形成提交记录。
- Windows 下如果 `npx prisma generate` 报 DLL rename 权限错误，通常是本地 `npm run dev` 正在占用 Prisma Client，先停止 dev server 后重试。
- 如果终端显示中文乱码，优先确认文件是否为 UTF-8 保存，以及当前终端代码页设置。
