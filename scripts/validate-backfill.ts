/**
 * 数据回灌校验脚本
 * 用法: npx tsx scripts/validate-backfill.ts
 * 直接查询 PostgreSQL，无需启动服务器。
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---- 工具函数 ----
function ok(text: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${text}`);
}
function warn(text: string) {
  console.log(`  \x1b[33m⚠\x1b[0m ${text}`);
}
function fail(text: string) {
  console.log(`  \x1b[31m✗\x1b[0m ${text}`);
}
function info(text: string) {
  console.log(`  \x1b[36m→\x1b[0m ${text}`);
}
function h2(text: string) {
  console.log(`\n\x1b[1m${text}\x1b[0m`);
  console.log("─".repeat(60));
}

function fmt(n: number | bigint): string {
  return Number(n).toLocaleString("zh-CN");
}

function pct(part: number, total: number): string {
  if (total === 0) return "N/A";
  return ((part / total) * 100).toFixed(1) + "%";
}

function ymd(d: Date | string | null): string {
  if (!d) return "NULL";
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// ---- 主流程 ----

async function main() {
  console.log("\n══════════════════════════════════════════");
  console.log("  数据回灌校验报告");
  console.log("  执行时间: " + new Date().toLocaleString("zh-CN", { hour12: false }));
  console.log("══════════════════════════════════════════");

  let issues = 0;

  // ==== 1. 历史表行数 ====
  h2("1. 历史表行数统计");
  try {
    const prodCount = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "ProductionWellHistory"`,
    );
    const waterCount = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "WaterWellHistory"`,
    );
    const pn = Number(prodCount[0].count);
    const wn = Number(waterCount[0].count);
    info(`ProductionWellHistory: ${fmt(pn)} 行`);
    info(`WaterWellHistory:      ${fmt(wn)} 行`);
    if (pn === 0 && wn === 0) {
      fail("两个历史表均为空——回灌可能未执行或全部失败");
      issues++;
    } else if (pn > 0 && wn > 0) {
      ok("两个表均有数据");
    } else {
      warn("其中一个表无数据，请检查是否只导入了部分数据集");
      issues++;
    }
  } catch (e: any) {
    fail(`查询行数失败: ${e.message}`);
    issues++;
  }

  // ==== 2. 日期范围 ====
  h2("2. 历史表日期范围");
  try {
    const prodRange = await prisma.$queryRawUnsafe<
      [{ min: Date; max: Date; months: bigint }]
    >(
      `SELECT MIN(rq) as min, MAX(rq) as max,
              COUNT(DISTINCT DATE_TRUNC('month', rq)) as months
       FROM "ProductionWellHistory"`,
    );
    const waterRange = await prisma.$queryRawUnsafe<
      [{ min: Date; max: Date; months: bigint }]
    >(
      `SELECT MIN(rq) as min, MAX(rq) as max,
              COUNT(DISTINCT DATE_TRUNC('month', rq)) as months
       FROM "WaterWellHistory"`,
    );

    const pr = prodRange[0];
    const wr = waterRange[0];

    info(`油井历史: ${ymd(pr.min)} ~ ${ymd(pr.max)}  跨越 ${pr.months} 个月`);
    info(`水井历史: ${ymd(wr.min)} ~ ${ymd(wr.max)}  跨越 ${wr.months} 个月`);

    // 预期从 2023-01 开始
    if (pr.min && new Date(pr.min) <= new Date("2023-02-01")) {
      ok("油井数据起始日期符合预期 (<=2023-01)");
    } else {
      warn(`油井起始日期较晚: ${ymd(pr.min)}，预期 2023-01 起步`);
      issues++;
    }
    if (wr.min && new Date(wr.min) <= new Date("2023-02-01")) {
      ok("水井数据起始日期符合预期 (<=2023-01)");
    } else {
      warn(`水井起始日期较晚: ${ymd(wr.min)}，预期 2023-01 起步`);
      issues++;
    }

    // 截止日期应在近期
    const now = new Date();
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (pr.max && new Date(pr.max) >= cutoff) {
      ok(`油井最新数据在近一周内 (${ymd(pr.max)})`);
    } else if (pr.max) {
      warn(`油井最新数据距今较久: ${ymd(pr.max)}，可能缺近期数据`);
      issues++;
    }
    if (wr.max && new Date(wr.max) >= cutoff) {
      ok(`水井最新数据在近一周内 (${ymd(wr.max)})`);
    } else if (wr.max) {
      warn(`水井最新数据距今较久: ${ymd(wr.max)}，可能缺近期数据`);
      issues++;
    }
  } catch (e: any) {
    fail(`查询日期范围失败: ${e.message}`);
    issues++;
  }

  // ==== 3. 唯一键检查 ====
  h2("3. 唯一键 (oracleScope, jh, rq) 约束效果");
  try {
    const prodDup = await prisma.$queryRawUnsafe<
      Array<{ scope: string; jh: string; rq: Date; dup: bigint }>
    >(
      `SELECT "oracleScope" as scope, jh, rq, COUNT(*) as dup
       FROM "ProductionWellHistory"
       GROUP BY "oracleScope", jh, rq
       HAVING COUNT(*) > 1
       LIMIT 10`,
    );
    const waterDup = await prisma.$queryRawUnsafe<
      Array<{ scope: string; jh: string; rq: Date; dup: bigint }>
    >(
      `SELECT "oracleScope" as scope, jh, rq, COUNT(*) as dup
       FROM "WaterWellHistory"
       GROUP BY "oracleScope", jh, rq
       HAVING COUNT(*) > 1
       LIMIT 10`,
    );

    if (prodDup.length === 0) {
      ok("ProductionWellHistory: 无重复键，唯一键约束有效");
    } else {
      fail(`ProductionWellHistory: 发现 ${prodDup.length} 组重复 (只展示前10组)`);
      for (const d of prodDup) {
        info(`  scope=${d.scope}  jh=${d.jh}  rq=${ymd(d.rq)}  dup=${d.dup}`);
      }
      issues++;
    }

    if (waterDup.length === 0) {
      ok("WaterWellHistory: 无重复键，唯一键约束有效");
    } else {
      fail(`WaterWellHistory: 发现 ${waterDup.length} 组重复 (只展示前10组)`);
      for (const d of waterDup) {
        info(`  scope=${d.scope}  jh=${d.jh}  rq=${ymd(d.rq)}  dup=${d.dup}`);
      }
      issues++;
    }
  } catch (e: any) {
    fail(`唯一键检查失败: ${e.message}`);
    issues++;
  }

  // ==== 4. 作业区分布 ====
  h2("4. 各作业区数据分布");
  try {
    const prodByUnit = await prisma.$queryRawUnsafe<
      Array<{ unit: string; cnt: bigint; wells: bigint; blocks: bigint }>
    >(
      `SELECT unit, COUNT(*) as cnt,
              COUNT(DISTINCT jh) as wells,
              COUNT(DISTINCT block) as blocks
       FROM "ProductionWellHistory"
       GROUP BY unit
       ORDER BY cnt DESC`,
    );
    const waterByUnit = await prisma.$queryRawUnsafe<
      Array<{ unit: string; cnt: bigint; wells: bigint; blocks: bigint }>
    >(
      `SELECT unit, COUNT(*) as cnt,
              COUNT(DISTINCT jh) as wells,
              COUNT(DISTINCT block) as blocks
       FROM "WaterWellHistory"
       GROUP BY unit
       ORDER BY cnt DESC`,
    );

    console.log("  油井历史 (ProductionWellHistory):");
    for (const r of prodByUnit) {
      info(`${r.unit.padEnd(14)} ${fmt(r.cnt).padStart(10)} 行  ${fmt(r.wells).padStart(5)} 井  ${fmt(r.blocks).padStart(3)} 区块`);
    }
    if (prodByUnit.length === 0) info("  (无数据)");

    console.log("  水井历史 (WaterWellHistory):");
    for (const r of waterByUnit) {
      info(`${r.unit.padEnd(14)} ${fmt(r.cnt).padStart(10)} 行  ${fmt(r.wells).padStart(5)} 井  ${fmt(r.blocks).padStart(3)} 区块`);
    }
    if (waterByUnit.length === 0) info("  (无数据)");

    const expectedUnits = ["采油作业一区", "采油作业二区", "采油作业三区"];
    const prodUnits = new Set(prodByUnit.map((r) => r.unit));
    const waterUnits = new Set(waterByUnit.map((r) => r.unit));
    for (const u of expectedUnits) {
      if (!prodUnits.has(u)) {
        warn(`油井历史缺少作业区: ${u}`);
        issues++;
      }
      if (!waterUnits.has(u)) {
        warn(`水井历史缺少作业区: ${u}`);
        issues++;
      }
    }
    if (expectedUnits.every((u) => prodUnits.has(u) && waterUnits.has(u))) {
      ok("三个作业区数据齐全");
    }
  } catch (e: any) {
    fail(`作业区分布查询失败: ${e.message}`);
    issues++;
  }

  // ==== 5. 字段格式抽样检查 ====
  h2("5. 字段格式抽样检查");
  try {
    const prodSample = await prisma.$queryRawUnsafe<
      Record<string, unknown>[]
    >(
      `SELECT * FROM "ProductionWellHistory"
       ORDER BY rq DESC
       LIMIT 5`,
    );
    const waterSample = await prisma.$queryRawUnsafe<
      Record<string, unknown>[]
    >(
      `SELECT * FROM "WaterWellHistory"
       ORDER BY rq DESC
       LIMIT 5`,
    );

    // 油井必填字段
    const prodRequired = [
      "jh",
      "unit",
      "oracleScope",
      "rq",
      "liquid",
      "oil",
      "waterCut",
      "gas",
    ];
    console.log("  油井样本字段检查 (前5行):");
    for (const row of prodSample) {
      const jh = String(row.jh ?? "?");
      const missing = prodRequired.filter((f) => row[f] === null || row[f] === undefined);
      const nanFields = prodRequired.filter(
        (f) => typeof row[f] === "number" && !isFinite(row[f] as number),
      );
      if (missing.length > 0) {
        warn(`  ${jh}: 缺失字段 [${missing.join(", ")}]`);
        issues++;
      }
      if (nanFields.length > 0) {
        warn(`  ${jh}: NaN/Infinity 字段 [${nanFields.join(", ")}]`);
        issues++;
      }
      // 检查井号不为空字符串
      if (!row.jh || String(row.jh).trim() === "") {
        warn(`  发现空井号的记录`);
        issues++;
      }
      // 检查 block/station 不为空
      if (!row.block || String(row.block).trim() === "") {
        info(`  jh=${jh}: block 为空 (可能是正常情况)`);
      }
      if (!row.station || String(row.station).trim() === "") {
        info(`  jh=${jh}: station 为空 (可能是正常情况)`);
      }
    }
    if (prodSample.length > 0 && prodSample.every((r) => r.jh && String(r.jh).trim() !== "")) {
      ok(`油井样本 (${prodSample.length}行): 核心字段格式正常`);
    }

    // 水井必填字段
    const waterRequired = [
      "jh",
      "unit",
      "oracleScope",
      "rq",
      "dailyWater",
      "block",
    ];
    console.log("  水井样本字段检查 (前5行):");
    for (const row of waterSample) {
      const jh = String(row.jh ?? "?");
      const missing = waterRequired.filter(
        (f) => row[f] === null || row[f] === undefined,
      );
      const nanFields = waterRequired.filter(
        (f) => typeof row[f] === "number" && !isFinite(row[f] as number),
      );
      if (missing.length > 0) {
        warn(`  ${jh}: 缺失字段 [${missing.join(", ")}]`);
        issues++;
      }
      if (nanFields.length > 0) {
        warn(`  ${jh}: NaN/Infinity 字段 [${nanFields.join(", ")}]`);
        issues++;
      }
      if (!row.jh || String(row.jh).trim() === "") {
        warn(`  发现空井号的记录`);
        issues++;
      }
    }
    if (waterSample.length > 0 && waterSample.every((r) => r.jh && String(r.jh).trim() !== "")) {
      ok(`水井样本 (${waterSample.length}行): 核心字段格式正常`);
    }
  } catch (e: any) {
    fail(`字段格式检查失败: ${e.message}`);
    issues++;
  }

  // ==== 6. 数值字段范围检查 ====
  h2("6. 数值字段合理范围检查");
  try {
    type Stat = { field: string; min: number; max: number; avg: number; nulls: bigint };
    const prodStats = await prisma.$queryRawUnsafe<Stat[]>(
      `SELECT 'liquid' as field, MIN(liquid) as min, MAX(liquid) as max, ROUND(AVG(liquid)::numeric, 2) as avg, SUM(CASE WHEN liquid IS NULL THEN 1 ELSE 0 END) as nulls FROM "ProductionWellHistory"
       UNION ALL
       SELECT 'oil', MIN(oil), MAX(oil), ROUND(AVG(oil)::numeric, 2), SUM(CASE WHEN oil IS NULL THEN 1 ELSE 0 END) FROM "ProductionWellHistory"
       UNION ALL
       SELECT 'waterCut', MIN("waterCut"), MAX("waterCut"), ROUND(AVG("waterCut")::numeric, 2), SUM(CASE WHEN "waterCut" IS NULL THEN 1 ELSE 0 END) FROM "ProductionWellHistory"
       UNION ALL
       SELECT 'gas', MIN(gas), MAX(gas), ROUND(AVG(gas)::numeric, 2), SUM(CASE WHEN gas IS NULL THEN 1 ELSE 0 END) FROM "ProductionWellHistory"
       UNION ALL
       SELECT 'productionHours', MIN("productionHours"), MAX("productionHours"), ROUND(AVG("productionHours")::numeric, 2), SUM(CASE WHEN "productionHours" IS NULL THEN 1 ELSE 0 END) FROM "ProductionWellHistory"`,
    );
    const waterStats = await prisma.$queryRawUnsafe<Stat[]>(
      `SELECT 'dailyWater' as field, MIN("dailyWater") as min, MAX("dailyWater") as max, ROUND(AVG("dailyWater")::numeric, 2) as avg, SUM(CASE WHEN "dailyWater" IS NULL THEN 1 ELSE 0 END) as nulls FROM "WaterWellHistory"
       UNION ALL
       SELECT 'injectedLiquid', MIN("injectedLiquid"), MAX("injectedLiquid"), ROUND(AVG("injectedLiquid")::numeric, 2), SUM(CASE WHEN "injectedLiquid" IS NULL THEN 1 ELSE 0 END) FROM "WaterWellHistory"
       UNION ALL
       SELECT 'trunkPressure', MIN("trunkPressure"), MAX("trunkPressure"), ROUND(AVG("trunkPressure")::numeric, 2), SUM(CASE WHEN "trunkPressure" IS NULL THEN 1 ELSE 0 END) FROM "WaterWellHistory"
       UNION ALL
       SELECT 'oilPressure', MIN("oilPressure"), MAX("oilPressure"), ROUND(AVG("oilPressure")::numeric, 2), SUM(CASE WHEN "oilPressure" IS NULL THEN 1 ELSE 0 END) FROM "WaterWellHistory"
       UNION ALL
       SELECT 'productionHours', MIN("productionHours"), MAX("productionHours"), ROUND(AVG("productionHours")::numeric, 2), SUM(CASE WHEN "productionHours" IS NULL THEN 1 ELSE 0 END) FROM "WaterWellHistory"`,
    );

    console.log("  油井数值字段:");
    for (const s of prodStats) {
      const flag =
        s.nulls > 0n ? "  (有NULL)" : "";
      info(`${s.field.padEnd(18)} min=${String(s.min).padStart(8)} max=${String(s.max).padStart(10)} avg=${String(s.avg).padStart(10)}${flag}`);
      // 含水率应在 0-100 左右
      if (s.field === "waterCut" && (s.min < 0 || s.max > 105)) {
        warn("  含水率存在异常值 (<0 或 >105)");
        issues++;
      }
      // 生产时数一般不超过 24
      if (s.field === "productionHours" && s.max > 30) {
        warn(`  生产时数存在 >30 的值 (max=${s.max})`);
        issues++;
      }
    }

    console.log("  水井数值字段:");
    for (const s of waterStats) {
      const flag =
        s.nulls > 0n ? "  (有NULL)" : "";
      info(`${s.field.padEnd(18)} min=${String(s.min).padStart(8)} max=${String(s.max).padStart(10)} avg=${String(s.avg).padStart(10)}${flag}`);
    }
  } catch (e: any) {
    fail(`数值范围检查失败: ${e.message}`);
    issues++;
  }

  // ==== 7. 导入运行记录 ====
  h2("7. OracleImportRun 运行记录");
  try {
    const runs = await prisma.$queryRawUnsafe<
      { status: string; cnt: bigint }[]
    >(
      `SELECT status, COUNT(*) as cnt FROM "OracleImportRun" GROUP BY status ORDER BY status`,
    );
    const totalRuns = runs.reduce((s, r) => s + Number(r.cnt), 0);
    info(`总运行批次: ${totalRuns}`);
    for (const r of runs) {
      const icon =
        r.status === "COMPLETED"
          ? ok
          : r.status === "FAILED"
            ? fail
            : r.status === "RUNNING"
              ? warn
              : info;
      icon(`  ${r.status.padEnd(12)} ${r.cnt} 个 chunk`);
    }

    const failedRuns = await prisma.$queryRawUnsafe<
      { id: string; dataset: string; scopeValue: string; chunkKey: string; error: string | null; startedAt: Date }[]
    >(
      `SELECT id, dataset, "scopeValue", "chunkKey", error, "startedAt"
       FROM "OracleImportRun"
       WHERE status = 'FAILED'
       ORDER BY "startedAt" DESC
       LIMIT 10`,
    );
    if (failedRuns.length > 0) {
      warn(`存在 ${failedRuns.length} 个失败 chunk (只展示前10个):`);
      for (const r of failedRuns) {
        info(`  ${r.dataset}/${r.scopeValue}/${r.chunkKey}: ${r.error?.slice(0, 100) || "无错误信息"}`);
      }
      issues += failedRuns.length;
    } else if (totalRuns > 0) {
      ok("无失败 chunk");
    }
  } catch (e: any) {
    fail(`运行记录查询失败: ${e.message}`);
    issues++;
  }

  // ==== 8. 快照状态 ====
  h2("8. OracleRefreshBatch 快照状态");
  try {
    const batches = await prisma.$queryRawUnsafe<
      {
        dataset: string;
        status: string;
        isActive: boolean;
        rowCount: number;
        finishedAt: Date | null;
      }[]
    >(
      `SELECT dataset, status, "isActive", "rowCount", "finishedAt"
       FROM "OracleRefreshBatch"
       ORDER BY "startedAt" DESC
       LIMIT 10`,
    );

    if (batches.length === 0) {
      warn("无快照记录——快照可能从未刷新");
      issues++;
    } else {
      for (const b of batches) {
        const label = b.isActive ? "  [ACTIVE]" : "";
        const statusIcon =
          b.status === "COMPLETED"
            ? ok
            : b.status === "FAILED"
              ? fail
              : info;
        statusIcon(
          `${b.dataset.padEnd(25)} ${b.status.padEnd(12)} ${fmt(b.rowCount).padStart(8)} 行${b.finishedAt ? "  " + ymd(b.finishedAt) : ""}${label}`,
        );
      }

      // 检查是否有活跃快照
      const activeBatch = batches.find((b) => b.isActive && b.status === "COMPLETED");
      const prodActive = batches.find(
        (b) => b.dataset === "production_wells" && b.isActive && b.status === "COMPLETED",
      );
      const waterActive = batches.find(
        (b) => b.dataset === "water_block_daily" && b.isActive && b.status === "COMPLETED",
      );
      if (!prodActive) {
        warn("无活跃的油井快照——前端将回退到 Oracle 实时查询");
        issues++;
      }
      if (!waterActive) {
        warn("无活跃的水井快照——前端将回退到 Oracle 实时查询");
        issues++;
      }
      if (prodActive && waterActive) {
        ok("油井和水井快照均就绪");
      }
    }
  } catch (e: any) {
    fail(`快照状态查询失败: ${e.message}`);
    issues++;
  }

  // ==== 9. 快照与历史表数据一致性 ====
  h2("9. 快照数据表行数");
  try {
    const prodSnap = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "ProductionWellSnapshot"`,
    );
    const waterSnap = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "WaterBlockDailySnapshot"`,
    );
    info(`ProductionWellSnapshot:    ${fmt(prodSnap[0].count)} 行`);
    info(`WaterBlockDailySnapshot:   ${fmt(waterSnap[0].count)} 行`);

    if (Number(prodSnap[0].count) === 0) {
      warn("油井快照表为空——快照可能未成功刷新");
      issues++;
    }
    if (Number(waterSnap[0].count) === 0) {
      warn("水井快照表为空——快照可能未成功刷新");
      issues++;
    }
    if (Number(prodSnap[0].count) > 0 && Number(waterSnap[0].count) > 0) {
      ok("快照表均有数据");
    }
  } catch (e: any) {
    fail(`快照表行数查询失败: ${e.message}`);
    issues++;
  }

  // ==== 10. 从历史表重建快照的数据预览 ====
  h2("10. 快照数据抽样");
  try {
    const prodSnapSample = await prisma.$queryRawUnsafe<
      Record<string, unknown>[]
    >(
      `SELECT unit, jh, rq, block, station, liquid, oil, "waterCut", gas
       FROM "ProductionWellSnapshot"
       ORDER BY rq DESC
       LIMIT 5`,
    );
    const waterSnapSample = await prisma.$queryRawUnsafe<
      Record<string, unknown>[]
    >(
      `SELECT unit, block, rq, total, open, injection
       FROM "WaterBlockDailySnapshot"
       ORDER BY rq DESC
       LIMIT 5`,
    );

    console.log("  油井快照样本:");
    for (const r of prodSnapSample) {
      info(`${r.jh}  ${r.rq}  液${r.liquid} 油${r.oil} 含水${r.waterCut}%  区块${r.block}`);
    }
    if (prodSnapSample.length === 0) info("  (无数据)");

    console.log("  水井快照样本:");
    for (const r of waterSnapSample) {
      info(`${r.block}  ${r.rq}  总井${r.total} 开井${r.open} 日注${r.injection}m³`);
    }
    if (waterSnapSample.length === 0) info("  (无数据)");
  } catch (e: any) {
    fail(`快照抽样失败: ${e.message}`);
    issues++;
  }

  // ==== 汇总 ====
  console.log("\n══════════════════════════════════════════");
  if (issues === 0) {
    console.log("  \x1b[32m✓ 校验完成，未发现问题\x1b[0m");
  } else {
    console.log(`  \x1b[33m⚠ 校验完成，发现 ${issues} 个问题\x1b[0m`);
  }
  console.log("══════════════════════════════════════════\n");

  await prisma.$disconnect();
  process.exit(issues > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("脚本执行失败:", e);
  process.exit(1);
});
