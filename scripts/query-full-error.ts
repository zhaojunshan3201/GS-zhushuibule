/**
 * 查询采油作业三区水井导入的完整错误信息
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  // 1. 查完整错误
  const failed = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, dataset, "scopeValue", "chunkKey", error, "startedAt", "rowCount"
     FROM "OracleImportRun"
     WHERE status = 'FAILED'
       AND dataset = 'water_history'
       AND "scopeValue" = '采油作业三区'
     ORDER BY "startedAt" DESC
     LIMIT 3`
  );

  console.log("=== 采油作业三区水井导入完整错误 ===\n");
  for (const r of failed) {
    console.log(`chunkKey: ${r.chunkKey}`);
    console.log(`startedAt: ${r.startedAt}`);
    console.log(`rowCount: ${r.rowCount}`);
    console.log(`完整错误:\n${r.error}`);
    console.log("---");
  }

  // 2. 查最早成功和最早失败的 chunk，看分界线
  const boundary = await prisma.$queryRawUnsafe<any[]>(
    `SELECT status, "chunkKey", "startedAt", "rowCount",
            CASE WHEN error IS NOT NULL THEN substring(error, 1, 200) ELSE NULL END as error_short
     FROM "OracleImportRun"
     WHERE dataset = 'water_history'
       AND "scopeValue" = '采油作业三区'
     ORDER BY "chunkKey" DESC
     LIMIT 20`
  );

  console.log("\n=== 采油作业三区水井: 最近20个chunk ===\n");
  for (const r of boundary) {
    const icon = r.status === "COMPLETED" ? "✓" : "✗";
    console.log(`${icon} ${r.chunkKey}  ${r.status}  rows=${r.rowCount}  ${r.error_short || ""}`);
  }

  // 3. 检查成功导入的 OracleImportRun 记录
  const successRun = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, "chunkKey" FROM "OracleImportRun"
     WHERE dataset = 'water_history'
       AND "scopeValue" = '采油作业三区'
       AND status = 'COMPLETED'
     ORDER BY "chunkKey" DESC
     LIMIT 1`
  );

  if (successRun.length > 0) {
    console.log(`\n最近成功导入的 importRunId: ${successRun[0].id}`);
    console.log(`对应 chunkKey: ${successRun[0].chunkKey}`);

    // 检查 WaterWellHistory 中引用这个 importRunId 的记录数
    const count = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as cnt FROM "WaterWellHistory" WHERE "importRunId" = $1`,
      successRun[0].id
    );
    console.log(`该 batch 在 WaterWellHistory 中的行数: ${count[0].cnt}`);
  }

  // 4. 检查 FK 约束名
  console.log("\n=== 外键约束信息 ===");
  const fks = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       tc.constraint_name,
       kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints AS tc
     JOIN information_schema.key_column_usage AS kcu
       ON tc.constraint_name = kcu.constraint_name
     JOIN information_schema.constraint_column_usage AS ccu
       ON ccu.constraint_name = tc.constraint_name
     WHERE tc.table_name = 'WaterWellHistory'
       AND tc.constraint_type = 'FOREIGN KEY'`
  );
  for (const fk of fks) {
    console.log(`  ${fk.constraint_name}: ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
