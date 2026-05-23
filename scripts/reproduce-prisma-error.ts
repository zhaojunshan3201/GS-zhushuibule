/**
 * 复现 Prisma createMany 拒绝采油作业三区水井数据的真实错误
 * 用法: npx tsx scripts/reproduce-prisma-error.ts
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient() as PrismaClient & {
  waterWellHistory?: any;
};

async function main() {
  console.log("=== 复现 Prisma createMany 错误 ===\n");

  // 从已导入的数据中取一行真实 Oracle 数据
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "WaterWellHistory"
     WHERE "oracleScope" = '高采采油作业三区'
     ORDER BY rq DESC
     LIMIT 1`,
  );

  if (existing.length === 0) {
    console.log("无已导入数据，改为构造测试数据");
  }

  // 构造一个有 NULL 浮点字段的行（模拟Oracle返回的原始数据）
  const testRows = [
    // 正常行 - 所有Float都有值（模拟已成功导入的5口井）
    {
      unit: "采油作业三区",
      oracleScope: "高采采油作业三区",
      factory: "高升采油厂",
      jh: "TEST-001",
      rq: new Date("2026-05-01T00:00:00.000Z"),
      block: "3块L6",
      station: "测试站",
      productionHours: 24,
      injectionMode: "1",
      trunkPressure: 6.5,
      oilPressure: 4.5,
      casingPressure: 2,
      valveGroupPressure: 0,
      manifoldPressure: 0,
      wellheadIron: 0,
      wellheadImpurity: 0,
      allocatedWater: 200,
      dailyWater: 203,
      injectedLiquid: 203,
      allocatedLayers: 2,
      overflow: 0,
      remarkCode: null,
      remark: null,
      importRunId: "00000000-0000-0000-0000-000000000000",
    },
    // 问题行 - 模拟Oracle中NULL字段的行（高3-4-43C的实际情况）
    {
      unit: "采油作业三区",
      oracleScope: "高采采油作业三区",
      factory: "高升采油厂",
      jh: "TEST-002",
      rq: new Date("2026-05-02T00:00:00.000Z"),
      block: "3块L7",
      station: "测试站2",
      productionHours: 0,
      injectionMode: "1",
      trunkPressure: 0,      // Oracle: NULL → 映射为 0
      oilPressure: 0,        // Oracle: NULL → 映射为 0
      casingPressure: 0,     // Oracle: NULL → 映射为 0
      valveGroupPressure: 0, // Oracle: NULL → 映射为 0
      manifoldPressure: 0,   // Oracle: NULL → 映射为 0
      wellheadIron: 0,       // Oracle: NULL → 映射为 0
      wellheadImpurity: 0,   // Oracle: NULL → 映射为 0
      allocatedWater: 0,
      dailyWater: 0,
      injectedLiquid: 0,
      allocatedLayers: 0,    // Oracle: NULL → 映射为 0
      overflow: 0,
      remarkCode: null,
      remark: null,
      importRunId: "00000000-0000-0000-0000-000000000000",
    },
  ];

  console.log("测试行1 (正常值):");
  console.log(JSON.stringify(testRows[0], null, 2));
  console.log("\n测试行2 (Oracle NULL → 0):");
  console.log(JSON.stringify(testRows[1], null, 2));

  // 测试1: 正常行
  console.log("\n--- 测试1: createMany 正常行 ---");
  try {
    const result = await prisma.waterWellHistory.createMany({
      data: [testRows[0]],
      skipDuplicates: true,
    });
    console.log(`✓ 成功, count=${result.count}`);
  } catch (e: any) {
    console.log(`✗ 失败: ${e.message}`);
    // 打印完整错误链
    if (e.cause) console.log(`  cause: ${e.cause}`);
    if (e.meta) console.log(`  meta: ${JSON.stringify(e.meta)}`);
  }

  // 测试2: NULL→0 行
  console.log("\n--- 测试2: createMany NULL→0 行 ---");
  try {
    const result = await prisma.waterWellHistory.createMany({
      data: [testRows[1]],
      skipDuplicates: true,
    });
    console.log(`✓ 成功, count=${result.count}`);
  } catch (e: any) {
    console.log(`✗ 失败: ${e.message}`);
    if (e.cause) console.log(`  cause: ${e.cause}`);
    if (e.meta) console.log(`  meta: ${JSON.stringify(e.meta)}`);
  }

  // 测试3: Undefined 字段（模拟 fetchWaterHistoryChunk 可能的映射遗漏）
  console.log("\n--- 测试3: createMany undefined 字段 ---");
  try {
    // @ts-ignore - 故意不传某些字段
    const result = await prisma.waterWellHistory.createMany({
      data: [
        {
          unit: "采油作业三区",
          oracleScope: "高采采油作业三区",
          jh: "TEST-003",
          rq: new Date("2026-05-03T00:00:00.000Z"),
          importRunId: "00000000-0000-0000-0000-000000000000",
          // 故意省略很多字段
        },
      ],
      skipDuplicates: true,
    });
    console.log(`✓ 成功, count=${result.count}`);
  } catch (e: any) {
    console.log(`✗ 失败: ${e.message}`);
    // 这个错误会告诉我们哪些字段缺失
  }

  // 测试4: Infinity/NaN
  console.log("\n--- 测试4: createMany NaN 值 ---");
  try {
    const badRow = { ...testRows[0], jh: "TEST-004", rq: new Date("2026-05-04T00:00:00.000Z"), trunkPressure: NaN };
    const result = await prisma.waterWellHistory.createMany({
      data: [badRow],
      skipDuplicates: true,
    });
    console.log(`✓ 成功, count=${result.count}`);
  } catch (e: any) {
    console.log(`✗ 失败: ${e.message}`);
  }

  // 清理测试数据
  console.log("\n--- 清理测试数据 ---");
  try {
    await prisma.$queryRawUnsafe(
      `DELETE FROM "WaterWellHistory" WHERE jh LIKE 'TEST-%'`
    );
    console.log("✓ 已清理");
  } catch (e: any) {
    console.log(`清理失败: ${e.message}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
