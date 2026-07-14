import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const p = new PrismaClient();
const out = "C:/ZS/gszhushuiSQL/data-export";
if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

async function save(name, data) {
  const file = out + "/" + name + ".json";
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(name + ": " + data.length + " rows -> " + file);
}

try {
  const da = await p.dynamicAnalysisRecord.findMany();
  await save("dynamicAnalysisRecord", da);
} catch(e) { console.log("DA failed: " + e.message); }

try {
  const ph = await p.productionWellHistory.findMany({
    where: { rq: { gte: new Date("2024-01-01"), lte: new Date("2026-12-31") } },
    take: 50000
  });
  await save("productionWellHistory", ph);
} catch(e) { console.log("PH failed: " + e.message); }

try {
  const wh = await p.waterWellHistory.findMany({
    where: { rq: { gte: new Date("2024-01-01"), lte: new Date("2026-12-31") } },
    take: 50000
  });
  await save("waterWellHistory", wh);
} catch(e) { console.log("WH failed: " + e.message); }

await p.$disconnect();
console.log("Done");
