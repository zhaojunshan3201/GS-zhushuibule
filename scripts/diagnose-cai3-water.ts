/**
 * 诊断采油作业三区水井导入失败根因
 * 用法: npx tsx scripts/diagnose-cai3-water.ts
 */

import { PrismaClient } from "@prisma/client";
import oracledb from "oracledb";
import dotenv from "dotenv";

dotenv.config();

if (process.env.ORACLE_LIB_DIR) {
  try {
    oracledb.initOracleClient({ libDir: process.env.ORACLE_LIB_DIR });
  } catch (e) {
    console.error("Oracle client init failed:", e);
  }
}

const prisma = new PrismaClient() as PrismaClient & {
  waterWellHistory?: any;
};

const config = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECTION_STRING,
};

const SCOPE = "高采采油作业三区";

async function main() {
  console.log("=== 采油作业三区水井数据诊断 ===\n");

  // 1. 看看已成功导入的数据情况
  console.log("1. 已导入的水井历史数据:");
  try {
    const [count, unitDist, monthSample] = await Promise.all([
      prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
        `SELECT COUNT(*) as cnt FROM "WaterWellHistory" WHERE "oracleScope" = $1`, SCOPE
      ),
      prisma.$queryRawUnsafe<{ unit: string; cnt: bigint }[]>(
        `SELECT unit, COUNT(*) as cnt FROM "WaterWellHistory" WHERE "oracleScope" = $1 GROUP BY unit`, SCOPE
      ),
      prisma.$queryRawUnsafe<
        { jh: string; rq: Date; block: string; productionHours: number; dailyWater: number; trunkPressure: number; injectionMode: string }[]
      >(
        `SELECT jh, rq, block, "productionHours", "dailyWater", "trunkPressure", "injectionMode"
         FROM "WaterWellHistory"
         WHERE "oracleScope" = $1
         ORDER BY rq DESC
         LIMIT 5`, SCOPE
      ),
    ]);
    console.log(`  总行数: ${count[0].cnt}`);
    console.log(`  各unit: ${unitDist.map(r => `${r.unit}=${r.cnt}`).join(", ")}`);
    console.log("  最近5行:");
    for (const r of monthSample) {
      console.log(`    ${r.jh} ${r.rq?.toISOString().slice(0,10)} 块:${r.block} 时:${r.productionHours} 注:${r.dailyWater} 压:${r.trunkPressure} 模式:${r.injectionMode}`);
    }
  } catch (e: any) {
    console.log(`  查询失败: ${e.message}`);
  }

  // 2. 直接从 Oracle 抓取采油作业三区水井数据样本
  console.log("\n2. 从 Oracle 抓取采油作业三区水井样本 (2026-05):");
  let pool: oracledb.Pool | null = null;
  try {
    pool = await oracledb.createPool({
      ...config,
      poolMin: 1,
      poolMax: 2,
      poolIncrement: 1,
    });
    const conn = await pool.getConnection();

    // 先看 summary
    const summary = await conn.execute(
      `SELECT COUNT(*) as total,
              COUNT(DISTINCT a.jh) as wells,
              COUNT(DISTINCT c.qkdy) as blocks,
              MIN(a.rq) as min_date,
              MAX(a.rq) as max_date
       FROM dba02 a, daa01 c
       WHERE a.jh = c.jh
         AND c.km = :scope`,
      { scope: SCOPE },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const s = summary.rows?.[0] as any;
    console.log(`  Oracle源: ${s?.TOTAL ?? s?.total} 行, ${s?.WELLS ?? s?.wells} 井, ${s?.BLOCKS ?? s?.blocks} 区块`);
    console.log(`  日期范围: ${s?.MIN_DATE ?? s?.min_date} ~ ${s?.MAX_DATE ?? s?.max_date}`);

    // 抓取 2026-05 样本并逐字段检查
    const result = await conn.execute(
      `SELECT c.cm as factory,
              a.jh as jh,
              c.qkdy as block,
              a.jlzh as station,
              TO_CHAR(a.rq, 'YYYYMMDD') as rq,
              a.scsj as production_hours,
              a.zsfs as injection_mode,
              a.gxyl as trunk_pressure,
              a.yy as oil_pressure,
              a.ty as casing_pressure,
              a.fzyl as valve_group_pressure,
              a.hgyl as manifold_pressure,
              a.jkht as wellhead_iron,
              a.jkzz as wellhead_impurity,
              a.rpzsl as allocated_water,
              a.rzsl as daily_water,
              a.zryl as injected_liquid,
              a.pzcds as allocated_layers,
              a.yll as overflow,
              a.bzdm as remark_code,
              a.bz as remark
       FROM dba02 a, daa01 c
       WHERE a.jh = c.jh
         AND c.km = :scope
         AND a.rq >= TO_DATE('20260501', 'YYYYMMDD')
         AND a.rq <= TO_DATE('20260505', 'YYYYMMDD')
       ORDER BY a.rq, a.jh`,
      { scope: SCOPE },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const rows = result.rows ?? [];
    console.log(`\n  2026-05 样本行数: ${rows.length}`);

    if (rows.length === 0) {
      console.log("  ⚠ Oracle 返回 0 行！");
      console.log("  尝试不限定日期...");
      const r2 = await conn.execute(
        `SELECT c.cm as factory, a.jh as jh, c.qkdy as block, a.jlzh as station,
                TO_CHAR(a.rq, 'YYYYMMDD') as rq, a.scsj as production_hours,
                a.zsfs as injection_mode
         FROM dba02 a, daa01 c
         WHERE a.jh = c.jh AND c.km = :scope AND ROWNUM <= 5`,
        { scope: SCOPE },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      console.log(`  不限定日期: ${r2.rows?.length ?? 0} 行`);
      if (r2.rows && r2.rows.length > 0) {
        console.log(JSON.stringify(r2.rows[0], null, 2));
      }
      await conn.close();
      await pool.close();
      await prisma.$disconnect();
      return;
    }

    // 逐字段检查
    console.log("\n3. 字段级检查 (前10行):");
    const floatFields = [
      "production_hours", "trunk_pressure", "oil_pressure", "casing_pressure",
      "valve_group_pressure", "manifold_pressure", "wellhead_iron", "wellhead_impurity",
      "allocated_water", "daily_water", "injected_liquid", "allocated_layers", "overflow",
    ];
    const stringFields = [
      "factory", "jh", "block", "station", "rq", "injection_mode", "remark_code", "remark",
    ];

    let issueCount = 0;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i] as Record<string, unknown>;
      const jh = String(row.JH ?? row.jh ?? "?");
      const rq = String(row.RQ ?? row.rq ?? "?");

      const issues: string[] = [];
      for (const f of floatFields) {
        const val = row[f.toUpperCase()] ?? row[f];
        if (val === null || val === undefined) {
          issues.push(`${f}=NULL`);
        } else {
          const n = Number(val);
          if (!isFinite(n)) {
            issues.push(`${f}=${val} (非有限数)`);
          }
        }
      }
      for (const f of stringFields) {
        const val = row[f.toUpperCase()] ?? row[f];
        if (val === null || val === undefined) {
          // remark_code and remark are nullable
          if (f !== "remark_code" && f !== "remark") {
            issues.push(`${f}=NULL (必填)`);
          }
        }
      }

      if (issues.length > 0) {
        console.log(`  ✗ ${jh} ${rq}: ${issues.join(", ")}`);
        issueCount++;
      } else {
        console.log(`  ✓ ${jh} ${rq}: 所有字段正常`);
      }
    }

    if (issueCount > 0) {
      console.log(`\n  ⚠ ${issueCount} 行存在字段问题`);
    } else {
      console.log(`\n  ✓ 样本字段均正常`);
    }

    // 4. 尝试用 Prisma 插入一行测试
    if (rows.length > 0) {
      console.log("\n4. 尝试 Prisma createMany 插入 1 行测试:");
      const firstRow = rows[0] as Record<string, unknown>;

      function getVal(upper: string, lower: string, dflt: any = 0) {
        const v = firstRow[upper] ?? firstRow[lower];
        if (v === null || v === undefined) return dflt;
        return v;
      }

      const testRow = {
        unit: "采油作业三区",
        oracleScope: SCOPE,
        factory: String(getVal("FACTORY", "factory", "")),
        jh: String(getVal("JH", "jh", "")),
        rq: new Date(
          String(getVal("RQ", "rq", "20260101")).replace(
            /^(\d{4})(\d{2})(\d{2})$/,
            "$1-$2-$3"
          ) + "T00:00:00.000Z"
        ),
        block: String(getVal("BLOCK", "block", "未分区块")) || "未分区块",
        station: String(getVal("STATION", "station", "")),
        productionHours: Number(getVal("PRODUCTION_HOURS", "production_hours", 0)),
        injectionMode: String(getVal("INJECTION_MODE", "injection_mode", "")),
        trunkPressure: Number(getVal("TRUNK_PRESSURE", "trunk_pressure", 0)),
        oilPressure: Number(getVal("OIL_PRESSURE", "oil_pressure", 0)),
        casingPressure: Number(getVal("CASING_PRESSURE", "casing_pressure", 0)),
        valveGroupPressure: Number(getVal("VALVE_GROUP_PRESSURE", "valve_group_pressure", 0)),
        manifoldPressure: Number(getVal("MANIFOLD_PRESSURE", "manifold_pressure", 0)),
        wellheadIron: Number(getVal("WELLHEAD_IRON", "wellhead_iron", 0)),
        wellheadImpurity: Number(getVal("WELLHEAD_IMPURITY", "wellhead_impurity", 0)),
        allocatedWater: Number(getVal("ALLOCATED_WATER", "allocated_water", 0)),
        dailyWater: Number(getVal("DAILY_WATER", "daily_water", 0)),
        injectedLiquid: Number(getVal("INJECTED_LIQUID", "injected_liquid", 0)),
        allocatedLayers: Number(getVal("ALLOCATED_LAYERS", "allocated_layers", 0)),
        overflow: Number(getVal("OVERFLOW", "overflow", 0)),
        remarkCode: (firstRow["REMARK_CODE"] ?? firstRow["remark_code"] ?? null) as string | null,
        remark: (firstRow["REMARK"] ?? firstRow["remark"] ?? null) as string | null,
        importRunId: "00000000-0000-0000-0000-000000000000",
      };

      console.log("  测试数据:");
      console.log(JSON.stringify(testRow, null, 4));

      try {
        const result = await prisma.$queryRawUnsafe<any[]>(
          `INSERT INTO "WaterWellHistory" (
            id, "importRunId", unit, "oracleScope", factory, jh, rq, block, station,
            "productionHours", "injectionMode", "trunkPressure", "oilPressure",
            "casingPressure", "valveGroupPressure", "manifoldPressure",
            "wellheadIron", "wellheadImpurity", "allocatedWater", "dailyWater",
            "injectedLiquid", "allocatedLayers", overflow, "remarkCode", remark, "loadedAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15,
            $16, $17, $18, $19,
            $20, $21, $22, $23, $24, NOW()
          ) ON CONFLICT ("oracleScope", jh, rq) DO NOTHING
          RETURNING id`,
          testRow.importRunId,
          testRow.unit,
          testRow.oracleScope,
          testRow.factory,
          testRow.jh,
          testRow.rq,
          testRow.block,
          testRow.station,
          testRow.productionHours,
          testRow.injectionMode,
          testRow.trunkPressure,
          testRow.oilPressure,
          testRow.casingPressure,
          testRow.valveGroupPressure,
          testRow.manifoldPressure,
          testRow.wellheadIron,
          testRow.wellheadImpurity,
          testRow.allocatedWater,
          testRow.dailyWater,
          testRow.injectedLiquid,
          testRow.allocatedLayers,
          testRow.overflow,
          testRow.remarkCode,
          testRow.remark,
        );
        console.log(`  ✓ 插入成功, id=${result[0]?.id ?? "unknown"}`);

        // 清理测试数据
        if (result[0]?.id) {
          await prisma.$queryRawUnsafe(
            `DELETE FROM "WaterWellHistory" WHERE id = $1`,
            result[0].id,
          );
          console.log("  (测试数据已清理)");
        }
      } catch (e: any) {
        console.log(`  ✗ 插入失败: ${e.message}`);

        // 打印详细诊断
        console.log("\n5. 详细字段值诊断:");
        for (const [key, val] of Object.entries(testRow)) {
          const type = typeof val;
          const display = type === "string" ? `"${val}"` : String(val);
          const flag =
            val === null
              ? " ⚠ NULL"
              : val === undefined
                ? " ⚠ UNDEFINED"
                : val === ""
                  ? " ⚠ 空字符串"
                  : type === "number" && !isFinite(val as number)
                    ? " ⚠ NaN/Infinity"
                    : "";
          if (flag || key === "jh" || key === "rq" || key === "oracleScope") {
            console.log(`    ${key}: ${display} (${type})${flag}`);
          }
        }
      }
    }

    await conn.close();
  } catch (e: any) {
    console.log(`  Oracle 连接或查询失败: ${e.message}`);
  } finally {
    if (pool) await pool.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
