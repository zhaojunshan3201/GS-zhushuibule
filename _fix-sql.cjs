const fs = require("fs");
const p = "C:/ZS/gszhushuiSQL/oracle-dynamic-analysis.ts";
let c = fs.readFileSync(p, "utf8");

// Fix 1: Add deleteMany before creating new records
c = c.replace(
  "  const kinds = ['overall-oil','overall-water','single-oil','single-water'];\r\n  let total = 0;",
  "  const kinds = ['overall-oil','overall-water','single-oil','single-water'];\r\n  // Delete old records before re-syncing to avoid accumulation\r\n  for (const kind of kinds) {\r\n    await prisma.dynamicAnalysisRecord.deleteMany({ where: { kind } });\r\n  }\r\n  console.log('Cleared old dynamic analysis records');\r\n  let total = 0;"
);

// Fix 2: Update overall-oil SQL to include rcyl2 in liquid calculation
c = c.replace(
  'if (kind === "overall-oil") return "SELECT ROUND(COUNT(a.jh)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v0, ROUND(SUM(SIGN(a.scsj))/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v1, ROUND(SUM(a.rcyl+a.rcsl)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v2, ROUND(SUM(a.rcyl)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v3, ROUND(SUM(a.rcsl)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v4, ROUND(100*SUM(a.rcsl)/NULLIF(SUM(a.rcyl+a.rcsl),0),1) AS v5 FROM dba01 a, daa01 c WHERE a.rq>=TO_DATE(:s,\'yyyymmdd\') AND a.rq<=TO_DATE(:e,\'yyyymmdd\') AND a.jh=c.jh AND " + qkdyClause;',
  'if (kind === "overall-oil") return "SELECT ROUND(COUNT(a.jh)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v0, ROUND(SUM(SIGN(a.scsj))/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v1, ROUND(SUM(a.rcyl+a.rcsl+NVL(a.rcyl2,0))/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v2, ROUND(SUM(a.rcyl)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v3, ROUND(SUM(a.rcsl+NVL(a.rcyl2,0))/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v4, ROUND(100*SUM(a.rcsl+NVL(a.rcyl2,0))/NULLIF(SUM(a.rcyl+a.rcsl+NVL(a.rcyl2,0)),0),1) AS v5 FROM dba01 a, daa01 c WHERE a.rq>=TO_DATE(:s,\'yyyymmdd\') AND a.rq<=TO_DATE(:e,\'yyyymmdd\') AND a.jh=c.jh AND " + qkdyClause;'
);

fs.writeFileSync(p, c, "utf8");
console.log("Fixed oracle-dynamic-analysis.ts");
