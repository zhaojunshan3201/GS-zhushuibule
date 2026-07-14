const fs = require("fs");
const p = "C:/ZS/gszhushuiSQL/oracle-dynamic-analysis.ts";
let c = fs.readFileSync(p, "utf8");

// Fix single-oil SQL to include rcyl2 (matching overall-oil fix)
c = c.replace(
  'if (kind === "single-oil") return "SELECT a.jh, ROUND(SUM(a.scsj)/24,1) AS h, ROUND(SUM(a.rcyl+a.rcsl)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v0, ROUND(SUM(a.rcyl)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v1, ROUND(SUM(a.rcsl)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v2, ROUND(100*SUM(a.rcsl)/NULLIF(SUM(a.rcyl+a.rcsl),0),1) AS v3 FROM dba01 a, daa01 c WHERE a.rq>=TO_DATE(:s,\'yyyymmdd\') AND a.rq<=TO_DATE(:e,\'yyyymmdd\') AND (a.rcyl+a.rcsl)>0 AND a.jh=c.jh AND " + qkdyClause + " GROUP BY a.jh ORDER BY a.jh";',
  'if (kind === "single-oil") return "SELECT a.jh, ROUND(SUM(a.scsj)/24,1) AS h, ROUND(SUM(a.rcyl+a.rcsl+NVL(a.rcyl2,0))/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v0, ROUND(SUM(a.rcyl)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v1, ROUND(SUM(a.rcsl+NVL(a.rcyl2,0))/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v2, ROUND(100*SUM(a.rcsl+NVL(a.rcyl2,0))/NULLIF(SUM(a.rcyl+a.rcsl+NVL(a.rcyl2,0)),0),1) AS v3 FROM dba01 a, daa01 c WHERE a.rq>=TO_DATE(:s,\'yyyymmdd\') AND a.rq<=TO_DATE(:e,\'yyyymmdd\') AND (a.rcyl+a.rcsl+NVL(a.rcyl2,0))>0 AND a.jh=c.jh AND " + qkdyClause + " GROUP BY a.jh ORDER BY a.jh";'
);

fs.writeFileSync(p, c, "utf8");
console.log("Fixed single-oil SQL");
