import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const wells = [
  { unit: "\u91c7\u6cb9\u4f5c\u4e1a\u4e00\u533a", block: "\u533a\u57571", wellNo: "GS-101" },
  { unit: "\u91c7\u6cb9\u4f5c\u4e1a\u4e00\u533a", block: "\u533a\u57571", wellNo: "GS-102" },
  { unit: "\u91c7\u6cb9\u4f5c\u4e1a\u4e00\u533a", block: "\u533a\u57572", wellNo: "GS-103" },
  { unit: "\u91c7\u6cb9\u4f5c\u4e1a\u4e8c\u533a", block: "\u533a\u57572", wellNo: "GS-104" },
  { unit: "\u91c7\u6cb9\u4f5c\u4e1a\u4e8c\u533a", block: "\u533a\u57573", wellNo: "GS-105" },
  { unit: "\u91c7\u6cb9\u4f5c\u4e1a\u4e09\u533a", block: "\u533a\u57573", wellNo: "GS-106" },
];

const testIntervals = ["\u2160-\u2161", "\u2161-\u2162", "\u2162-\u2163", "\u2160-\u2162", "\u2161-\u2163"];

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

const rows = Array.from({ length: 38 }, (_, index) => {
  const well = wells[index % wells.length];
  const cycle = Math.floor(index / wells.length);
  const testDate = new Date(Date.UTC(2026, 4, 18 - cycle * 3 - (index % 3)));
  const injectionBase = 18 + (index % wells.length) * 2.6 + cycle * 1.8;
  const pressureBase = 7.8 + (index % wells.length) * 0.45 + cycle * 0.25;

  return {
    ...well,
    testDate,
    testInterval: testIntervals[(cycle + index) % testIntervals.length],
    injection1: round1(injectionBase),
    pressure1: round1(pressureBase),
    injection2: round1(injectionBase + 5.4),
    pressure2: round1(pressureBase + 0.8),
    injection3: round1(injectionBase + 10.8),
    pressure3: round1(pressureBase + 1.5),
    injection4: round1(injectionBase + 16.2),
    pressure4: round1(pressureBase + 2.2),
    injection5: round1(injectionBase + 21.6),
    pressure5: round1(pressureBase + 2.9),
  };
});

async function main() {
  await prisma.indicatorCurveRecord.deleteMany();
  await prisma.indicatorCurveRecord.createMany({ data: rows });
  const grouped = await prisma.indicatorCurveRecord.groupBy({
    by: ["wellNo", "testInterval"],
    _count: { _all: true },
    orderBy: [{ wellNo: "asc" }, { testInterval: "asc" }],
  });

  console.log(`Seeded ${rows.length} indicator curve records.`);
  console.table(grouped.map((item) => ({ wellNo: item.wellNo, testInterval: item.testInterval, count: item._count._all })));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
