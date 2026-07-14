import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const p = new PrismaClient();
const out = "C:/ZS/gszhushuiSQL/data-export";

async function saveChunked(name, model, year) {
  const start = new Date(year + "-01-01");
  const end = new Date(year + "-12-31");
  const count = await model.count({ where: { rq: { gte: start, lte: end } } });
  console.log(name + " " + year + ": " + count + " rows");
  if (count === 0) return;
  const rows = await model.findMany({ where: { rq: { gte: start, lte: end } } });
  fs.writeFileSync(out + "/" + name + "_" + year + ".json", JSON.stringify(rows));
  console.log("  -> saved " + rows.length);
}

try {
  await saveChunked("productionWellHistory", p.productionWellHistory, "2024");
  await saveChunked("productionWellHistory", p.productionWellHistory, "2025");
  await saveChunked("productionWellHistory", p.productionWellHistory, "2026");
} catch(e) { console.log("PH error: " + e.message); }

try {
  await saveChunked("waterWellHistory", p.waterWellHistory, "2024");
  await saveChunked("waterWellHistory", p.waterWellHistory, "2025");
  await saveChunked("waterWellHistory", p.waterWellHistory, "2026");
} catch(e) { console.log("WH error: " + e.message); }

await p.$disconnect();
console.log("Done");
