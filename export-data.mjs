import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";

async function main() {
  const prisma = new PrismaClient();
  const outDir = "C:/ZS/gszhushuiSQL/data-export";
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const summary = {};

  // 1. dynamicAnalysisRecord
  const da = await prisma.dynamicAnalysisRecord.findMany();
  fs.writeFileSync(outDir + "/dynamicAnalysisRecord.json", JSON.stringify(da, null, 2));
  summary.dynamicAnalysisRecord = da.length;
  console.log("dynamicAnalysisRecord: " + da.length);

  // 2. productionWellHistory (2024-2026)
  try {
    const ph = await prisma.productionWellHistory.findMany({
      where: { rq: { gte: new Date("2024-01-01"), lte: new Date("2026-12-31") } }
    });
    fs.writeFileSync(outDir + "/productionWellHistory.json", JSON.stringify(ph, null, 2));
    summary.productionWellHistory = ph.length;
    console.log("productionWellHistory: " + ph.length);
  } catch (e) { console.log("productionWellHistory: N/A - " + e.message); }

  // 3. waterWellHistory (2024-2026)
  try {
    const wh = await prisma.waterWellHistory.findMany({
      where: { rq: { gte: new Date("2024-01-01"), lte: new Date("2026-12-31") } }
    });
    fs.writeFileSync(outDir + "/waterWellHistory.json", JSON.stringify(wh, null, 2));
    summary.waterWellHistory = wh.length;
    console.log("waterWellHistory: " + wh.length);
  } catch (e) { console.log("waterWellHistory: N/A - " + e.message); }

  fs.writeFileSync(outDir + "/_summary.json", JSON.stringify(summary, null, 2));
  console.log("\nDone! " + outDir);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
