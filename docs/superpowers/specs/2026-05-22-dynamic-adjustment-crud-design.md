# 动态调配业务表格设计规格

**日期**: 2026-05-22
**状态**: 已确认设计方向，待实现计划

## 概述

将“动态调配”页面从占位页改为可录入、保存、编辑、删除、查询的动态业务表格。页面内容必须保持和用户截图一致，使用多级表头呈现“重点跟踪油井产量”，并保留截图中的两类调配目的行：

- 解决污水平衡
- 油井产状变化

本功能采用独立业务表和完整 CRUD API，不复用现有 `AdjustmentRecord`，因为现有模型字段不足以表达截图中的调配前后产量、差值、阶段效果等结构化数据。

## 成功标准

- 用户进入“动态调配”页面后看到与截图一致的表格结构。
- 用户可以新增、编辑、删除一条动态调配记录。
- 用户可以按井号、调配水井、调配日期范围、调配目的查询记录。
- 保存后的记录刷新页面仍能保留。
- 调配前后数据变化后，差值字段自动计算并保存。
- 空状态时仍显示截图风格的表格骨架和两条调配目的默认行。

## 表格结构

表头按截图保持一致：

| 分组 | 字段 |
| --- | --- |
| 固定列 | 调配水井 |
| 固定列 | 分注工艺 |
| 固定列 | 调配日期 |
| 固定列 | 调配前日注 |
| 固定列 | 调配后日注 |
| 固定列 | 调配目的 |
| 重点跟踪油井产量 | 井号 |
| 调配前 | 日产液、日产油、含水 |
| 调配后 | 日产液、日产油、含水 |
| 差值 | 日产液、日产油、含水 |
| 阶段效果 | 阶段天数、累增油 |

页面可额外增加最右侧“操作”列用于编辑和删除。操作列不属于截图业务内容，只用于系统交互；导出或打印时可以隐藏。

## 数据模型

新增 Prisma 模型 `DynamicAdjustmentRecord`：

```prisma
model DynamicAdjustmentRecord {
  id                    String   @id @default(uuid())
  adjustmentWaterWell    String
  injectionProcess       String?
  adjustmentDate         DateTime @db.Date
  beforeDailyInjection   Float?
  afterDailyInjection    Float?
  adjustmentPurpose      String
  trackedOilWell         String
  beforeDailyLiquid      Float?
  beforeDailyOil         Float?
  beforeWaterCut         Float?
  afterDailyLiquid       Float?
  afterDailyOil          Float?
  afterWaterCut          Float?
  diffDailyLiquid        Float?
  diffDailyOil           Float?
  diffWaterCut           Float?
  stageDays              Int?
  cumulativeOil          Float?
  remark                 String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  @@index([adjustmentDate])
  @@index([adjustmentWaterWell])
  @@index([trackedOilWell])
  @@index([adjustmentPurpose])
}
```

字段命名说明：

- `adjustmentWaterWell` 对应“调配水井”。
- `trackedOilWell` 对应“重点跟踪油井产量”下的“井号”。
- `diffDailyLiquid`、`diffDailyOil`、`diffWaterCut` 由调配后减调配前自动计算。
- `remark` 预留为后续备注，不在默认表格中展示，避免破坏截图一致性。

## API

新增后端接口：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/dynamic-adjustments` | 查询记录，支持筛选参数 |
| POST | `/api/dynamic-adjustments` | 新增记录 |
| PUT | `/api/dynamic-adjustments/:id` | 更新记录 |
| DELETE | `/api/dynamic-adjustments/:id` | 删除记录 |

查询参数：

- `adjustmentWaterWell`
- `trackedOilWell`
- `adjustmentPurpose`
- `fromDate`
- `toDate`

后端负责统一计算差值，避免前端和后端出现不一致。

## 前端页面

新增 `DynamicAdjustmentPage`，替换当前 `PlaceholderPage title="动态调配"`。

页面区域：

- 顶部标题：动态调配。
- 查询栏：调配水井、井号、调配目的、开始日期、结束日期、查询、重置、新增。
- 表格：使用与截图一致的多级表头，横向滚动适配小屏。
- 编辑表单：新增/编辑共用表单，字段顺序与截图一致。
- 状态提示：加载中、保存中、删除确认、错误提示。

录入体验：

- 新增时默认 `adjustmentPurpose` 可从“解决污水平衡 / 油井产状变化”选择。
- 调配前后日液、日油、含水输入后，差值在表单中即时预览。
- 保存时以后端返回值为准刷新列表。

## 空状态

如果没有记录，表格仍显示两条空业务行，调配目的分别为：

- 解决污水平衡
- 油井产状变化

这样页面视觉上与截图保持一致，同时提示用户可点击“新增”录入真实数据。

## 验证

- 运行 TypeScript 检查：`npm run lint`
- 运行构建：`npm run build`
- 手动验证：
  - 新增一条记录后表格出现该记录。
  - 编辑调配后日产油后，差值日产油随之变化。
  - 按井号查询只返回匹配记录。
  - 删除后刷新页面记录不再出现。
  - 空列表时显示两条默认调配目的行。

## 范围外

- 不做 Excel 导入导出。
- 不自动从 Oracle 产量历史回填调配前后数据。
- 不做审批流。
- 不改变其它页面的表格样式和数据模型。
