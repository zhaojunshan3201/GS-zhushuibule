# 第二批复杂表 PostgreSQL 打通设计

## 范围

第二批包含同心测调井史、智能测调井史、单井注入评价、单井密封评价、分注指标汇总、动态分析对比。目标是把当前页面展示的模拟数据存入 PostgreSQL，并让页面查询、筛选、新增、删除走后端接口。

## 数据结构

普通筛选字段拆列保存，例如井号、单位、区块、工艺、日期、分类。复杂分层字段使用 JSONB 保存，例如各层自由度、各层日注水量、内外压数组、封隔器统计、对比值和处理意见。这样能保留现有表格形态，同时避免为当前展示型数据过早拆出大量子表。

## 接口

每个页面使用独立 REST 资源：

- `/api/concentric-test-records`
- `/api/smart-test-records`
- `/api/single-well-injection-evaluations`
- `/api/single-well-seal-evaluations`
- `/api/zonal-indicator-summaries`
- `/api/dynamic-analysis-records`

列表接口支持服务端筛选。分页页面返回统一的 `{ rows, total, page, pageSize }`。

## 前端

保留原有表格表头、分页和视觉结构。页面本地数组只作为历史代码存在，不再作为渲染数据源。新增和删除通过接口刷新数据，筛选按钮重新请求后端。

## 验证

验证包括共享数据单元测试、Prisma schema 校验、迁移、seed、接口冒烟、TypeScript 检查和浏览器页面加载检查。
