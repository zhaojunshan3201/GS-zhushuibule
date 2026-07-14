// ====== Oracle Dynamic Analysis Queries (inserted by Codex) ======

type BlockConfig = { name: string; qkdyPattern: string; unit: string };

const DYNAMIC_ANALYSIS_BLOCKS: BlockConfig[] = [
  { name: "?11", qkdyPattern: "??%", unit: "??????" },
  { name: "?64", qkdyPattern: "?64%", unit: "??????" },
  { name: "?72", qkdyPattern: "?72", unit: "??????" },
  { name: "?????", qkdyPattern: "???N%", unit: "??????" },
  { name: "?????", qkdyPattern: "?????", unit: "??????" },
  { name: "?33", qkdyPattern: "?33", unit: "??????" },
];

function shiftPeriodMonths(startDate: string, endDate: string, monthsOffset: number) {
  const s = new Date(startDate.replace(/\//g, "-"));
  const e = new Date(endDate.replace(/\//g, "-"));
  s.setMonth(s.getMonth() + monthsOffset);
  e.setMonth(e.getMonth() + monthsOffset);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "/");
  return { start: fmt(s), end: fmt(e) };
}

function getPrevYearDecPeriod(startDate: string, endDate: string) {
  const year = parseInt(startDate.slice(0, 4), 10) - 1;
  return { start: year + startDate.slice(4), end: year + endDate.slice(4) };
}

const DA_OVERALL_OIL_SQL = `
SELECT ROUND(COUNT(jh)/NULLIF(COUNT(DISTINCT rq),0),1) AS v0,
 ROUND(SUM(SIGN(scsj))/NULLIF(COUNT(DISTINCT rq),0),1) AS v1,
 ROUND(SUM(rcyl+rcsl)/NULLIF(COUNT(DISTINCT rq),0),1) AS v2,
 ROUND(SUM(rcyl)/NULLIF(COUNT(DISTINCT rq),0),1) AS v3,
 ROUND(SUM(rcsl)/NULLIF(COUNT(DISTINCT rq),0),1) AS v4,
 ROUND(100*SUM(rcsl)/NULLIF(SUM(rcyl+rcsl),0),1) AS v5
FROM dba01 WHERE rq>=:s AND rq<=:e
AND jh IN (SELECT jh FROM daa01 WHERE qkdy LIKE :q)
`;

const DA_OVERALL_WATER_SQL = `
SELECT ROUND(COUNT(jh)/NULLIF(COUNT(DISTINCT rq),0),1) AS v0,
 ROUND(SUM(SIGN(scsj))/NULLIF(COUNT(DISTINCT rq),0),1) AS v1,
 ROUND(SUM(rzsl)/NULLIF(COUNT(DISTINCT rq),0),1) AS v2
FROM dba02 WHERE rq>=:s AND rq<=:e
AND jh IN (SELECT jh FROM daa01 WHERE qkdy LIKE :q)
`;

const DA_SINGLE_OIL_SQL = `
SELECT jh,
 ROUND(SUM(scsj)/24,1) AS h,
 ROUND(SUM(rcyl+rcsl)/NULLIF(COUNT(DISTINCT rq),0),1) AS v0,
 ROUND(SUM(rcyl)/NULLIF(COUNT(DISTINCT rq),0),1) AS v1,
 ROUND(SUM(rcsl)/NULLIF(COUNT(DISTINCT rq),0),1) AS v2,
 ROUND(100*SUM(rcsl)/NULLIF(SUM(rcyl+rcsl),0),1) AS v3
FROM dba01 WHERE rq>=:s AND rq<=:e AND (rcyl+rcsl)>0
AND jh IN (SELECT jh FROM daa01 WHERE qkdy LIKE :q)
GROUP BY jh ORDER BY jh
`;

const DA_SINGLE_WATER_SQL = `
SELECT jh,
 ROUND(SUM(scsj)/24,1) AS h,
 ROUND(SUM(rzsl)/NULLIF(COUNT(DISTINCT rq),0),1) AS v0,
 ROUND(SUM(yy)/NULLIF(COUNT(DISTINCT rq),0),1) AS v1,
 ROUND(SUM(ty)/NULLIF(COUNT(DISTINCT rq),0),1) AS v2
FROM dba02 WHERE rq>=:s AND rq<=:e
AND jh IN (SELECT jh FROM daa01 WHERE qkdy LIKE :q)
GROUP BY jh ORDER BY jh
`;

function daSql(kind: string): string {
  if (kind === "overall-oil") return DA_OVERALL_OIL_SQL;
  if (kind === "overall-water") return DA_OVERALL_WATER_SQL;
  if (kind === "single-oil") return DA_SINGLE_OIL_SQL;
  return DA_SINGLE_WATER_SQL;
}

function daRowToValues(kind: string, row: Record<string, unknown> | null): string[] {
  if (!row) return kind.startsWith("overall") ? (kind.includes("water") ? ["0","0","0"] : ["0","0","0","0","0"]) : ["0","0","0"];
  const r = (k: string) => String(row[k] ?? "0");
  if (kind === "overall-oil") return [r("V0"),r("V1"),r("V2"),r("V3"),r("V5")];
  if (kind === "overall-water") return [r("V0"),r("V1"),r("V2")];
  if (kind === "single-oil") return [r("V0"),r("V1"),r("V3")];
  return [r("V0"),r("V1"),r("V2")];
}

function daDiff(endVals: string[], cmpVals: string[]): string[] {
  return endVals.map((v, i) => {
    const d = parseFloat(v) - parseFloat(cmpVals[i] || "0");
    if (isNaN(d)) return "0";
    return (d >= 0 ? "+" : "") + d.toFixed(1);
  });
}

