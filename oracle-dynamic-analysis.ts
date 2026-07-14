// Oracle Dynamic Analysis Module v8 - only sync valid blocks
import { normalizeOilProductionBlock } from "./src/shared/oilProductionBlocks";
import { normalizeWaterInjectionBlock } from "./src/shared/waterInjectionBlocks";
type BlockConfig = { name: string; qkdyClause: string; unit: string };

const ALL_BLOCKS: BlockConfig[] = [
  // 采一 (7)
  { name: "高18(南)", qkdyClause: "c.qkdy = N'高18(南)'", unit: "高采采油作业一区" },
  { name: "高升零散井(采一)", qkdyClause: "c.qkdy = N'高升零散井(采一)'", unit: "高采采油作业一区" },
  { name: "雷64氮气驱", qkdyClause: "c.qkdy = N'雷64氮气驱'", unit: "高采采油作业一区" },
  { name: "雷64水驱", qkdyClause: "c.qkdy = N'雷64水驱'", unit: "高采采油作业一区" },
  { name: "雷72", qkdyClause: "c.qkdy = N'雷72'", unit: "高采采油作业一区" },
  { name: "雷家D", qkdyClause: "c.qkdy = N'雷家D'", unit: "高采采油作业一区" },
  { name: "雷家L", qkdyClause: "c.qkdy = N'雷家L'", unit: "高采采油作业一区" },
  // 采二 (10)
  { name: "牛心坨N1-3", qkdyClause: "c.qkdy = N'牛心坨N1-3'", unit: "高采采油作业二区" },
  { name: "牛心坨N4-5", qkdyClause: "c.qkdy = N'牛心坨N4-5'", unit: "高采采油作业二区" },
  { name: "牛心坨N6-7", qkdyClause: "c.qkdy = N'牛心坨N6-7'", unit: "高采采油作业二区" },
  { name: "牛心坨零散井", qkdyClause: "c.qkdy = N'牛心坨零散井'", unit: "高采采油作业二区" },
  { name: "牛心坨潜山", qkdyClause: "c.qkdy = N'牛心坨潜山'", unit: "高采采油作业二区" },
  { name: "宋1未开发区", qkdyClause: "c.qkdy = N'宋1未开发区'", unit: "高采采油作业二区" },
  { name: "坨19", qkdyClause: "c.qkdy = N'坨19'", unit: "高采采油作业二区" },
  { name: "坨25", qkdyClause: "c.qkdy = N'坨25'", unit: "高采采油作业二区" },
  { name: "坨32未开发区", qkdyClause: "c.qkdy = N'坨32未开发区'", unit: "高采采油作业二区" },
  { name: "坨33", qkdyClause: "c.qkdy = N'坨33'", unit: "高采采油作业二区" },
  // 采三 (21)
  { name: "246块L1-4", qkdyClause: "c.qkdy = N'246块L1-4'", unit: "高采采油作业三区" },
  { name: "246块L5", qkdyClause: "c.qkdy = N'246块L5'", unit: "高采采油作业三区" },
  { name: "246块L6", qkdyClause: "c.qkdy = N'246块L6'", unit: "高采采油作业三区" },
  { name: "3618块L4", qkdyClause: "c.qkdy = N'3618块L4'", unit: "高采采油作业三区" },
  { name: "3618块L5", qkdyClause: "c.qkdy = N'3618块L5'", unit: "高采采油作业三区" },
  { name: "3618块L6", qkdyClause: "c.qkdy = N'3618块L6'", unit: "高采采油作业三区" },
  { name: "3624块(北)L5", qkdyClause: "c.qkdy = N'3624块(北)L5'", unit: "高采采油作业三区" },
  { name: "3624块(北)L6", qkdyClause: "c.qkdy = N'3624块(北)L6'", unit: "高采采油作业三区" },
  { name: "3624块(南)L5", qkdyClause: "c.qkdy = N'3624块(南)L5'", unit: "高采采油作业三区" },
  { name: "3624块(南)L6", qkdyClause: "c.qkdy = N'3624块(南)L6'", unit: "高采采油作业三区" },
  { name: "3块L5", qkdyClause: "c.qkdy = N'3块L5'", unit: "高采采油作业三区" },
  { name: "3块L6", qkdyClause: "c.qkdy = N'3块L6'", unit: "高采采油作业三区" },
  { name: "3块L7", qkdyClause: "c.qkdy = N'3块L7'", unit: "高采采油作业三区" },
  { name: "高10", qkdyClause: "c.qkdy = N'高10'", unit: "高采采油作业三区" },
  { name: "高101", qkdyClause: "c.qkdy = N'高101'", unit: "高采采油作业三区" },
  { name: "高18(北)", qkdyClause: "c.qkdy = N'高18(北)'", unit: "高采采油作业三区" },
  { name: "高21(北)", qkdyClause: "c.qkdy = N'高21(北)'", unit: "高采采油作业三区" },
  { name: "高21(南)", qkdyClause: "c.qkdy = N'高21(南)'", unit: "高采采油作业三区" },
  { name: "高372108", qkdyClause: "c.qkdy = N'高372108'", unit: "高采采油作业三区" },
  { name: "高81", qkdyClause: "c.qkdy = N'高81'", unit: "高采采油作业三区" },
  { name: "高二三区高升油层未", qkdyClause: "c.qkdy = N'高二三区高升油层未'", unit: "高采采油作业三区" },
];

// Only sync blocks with valid consolidated mapping
const BLOCKS: BlockConfig[] = ALL_BLOCKS.filter(b => {
  const oc = normalizeOilProductionBlock(b.unit, b.name);
  const wc = normalizeWaterInjectionBlock(b.unit, b.name);
  return oc !== null || wc !== null;
});


const fmt8 = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

/** Last day of the previous ten-day period (?). */
function lastDayOfPreviousXun(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const day = d.getDate();
  if (day <= 10) {
    d.setMonth(d.getMonth(), 0); // last day of previous month
  } else if (day <= 20) {
    d.setDate(10);
  } else {
    d.setDate(20);
  }
  return d;
}

/** Full previous month range (e.g., June 1-30 when current is July). */
function previousMonthRange(ref: Date): { start: string; end: string } {
  const first = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const last = new Date(ref.getFullYear(), ref.getMonth(), 0);
  return { start: fmt8(first), end: fmt8(last) };
}

/** Full December of the previous year (e.g., Dec 1-31 2025 when current is 2026). */
function previousYearDecember(): { start: string; end: string } {
  const y = new Date().getFullYear() - 1;
  return { start: fmt8(new Date(y, 11, 1)), end: fmt8(new Date(y, 11, 31)) };
}

function buildSql(kind: string, qkdyClause: string): string {
  if (kind === "overall-oil") return "SELECT ROUND(COUNT(a.jh)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v0, ROUND(SUM(SIGN(a.scsj))/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v1, ROUND(SUM(a.rcyl+a.rcsl+NVL(a.rcyl2,0))/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v2, ROUND(SUM(a.rcyl)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v3, ROUND(SUM(a.rcsl+NVL(a.rcyl2,0))/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v4, ROUND(100*SUM(a.rcsl+NVL(a.rcyl2,0))/NULLIF(SUM(a.rcyl+a.rcsl+NVL(a.rcyl2,0)),0),1) AS v5 FROM dba01 a, daa01 c WHERE a.rq>=TO_DATE(:s,'yyyymmdd') AND a.rq<=TO_DATE(:e,'yyyymmdd') AND a.jh=c.jh AND " + qkdyClause;
  if (kind === "overall-water") return "SELECT ROUND(COUNT(a.jh)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v0, ROUND(SUM(SIGN(a.scsj))/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v1, ROUND(SUM(a.rzsl)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v2 FROM dba02 a, daa01 c WHERE a.rq>=TO_DATE(:s,'yyyymmdd') AND a.rq<=TO_DATE(:e,'yyyymmdd') AND a.jh=c.jh AND " + qkdyClause;
  if (kind === "single-oil") return "SELECT a.jh, ROUND(SUM(a.scsj)/24,1) AS h, ROUND(SUM(a.rcyl+a.rcsl+NVL(a.rcyl2,0))/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v0, ROUND(SUM(a.rcyl)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v1, ROUND(SUM(a.rcsl+NVL(a.rcyl2,0))/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v2, ROUND(100*SUM(a.rcsl+NVL(a.rcyl2,0))/NULLIF(SUM(a.rcyl+a.rcsl+NVL(a.rcyl2,0)),0),1) AS v3 FROM dba01 a, daa01 c WHERE a.rq>=TO_DATE(:s,'yyyymmdd') AND a.rq<=TO_DATE(:e,'yyyymmdd') AND (a.rcyl+a.rcsl+NVL(a.rcyl2,0))>0 AND a.jh=c.jh AND " + qkdyClause + " GROUP BY a.jh ORDER BY a.jh";
  return "SELECT a.jh, ROUND(SUM(a.scsj)/24,1) AS h, ROUND(SUM(a.rzsl)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v0, ROUND(SUM(a.yy)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v1, ROUND(SUM(a.ty)/NULLIF(COUNT(DISTINCT a.rq),0),1) AS v2 FROM dba02 a, daa01 c WHERE a.rq>=TO_DATE(:s,'yyyymmdd') AND a.rq<=TO_DATE(:e,'yyyymmdd') AND a.jh=c.jh AND " + qkdyClause + " GROUP BY a.jh ORDER BY a.jh";
}


function toVals(kind: string, row: unknown): string[] {
  if (!row || typeof row !== "object") return kind.startsWith("overall") ? (kind.includes("water")?["0","0","0"]:["0","0","0","0","0"]) : ["0","0","0"];
  const source = row as Record<string, unknown>;
  const r = (key: string) => String(source[key] ?? "0");
  const ceilInt = (v: string) => { const n = parseFloat(v); return isNaN(n) ? v : String(Math.ceil(n)); };
  if (kind === "overall-oil") return [ceilInt(r("V0")),ceilInt(r("V1")),r("V2"),r("V3"),r("V5")];
  if (kind === "overall-water") return [ceilInt(r("V0")),ceilInt(r("V1")),r("V2")];
  if (kind === "single-oil") return [r("V0"),r("V1"),r("V3")];
  return [r("V0"),r("V1"),r("V2")];
}

function daDiff(a: string[], b: string[]): string[] {
  return a.map((v, i) => { const d = parseFloat(v) - parseFloat(b[i]||"0"); return isNaN(d) ? "0" : (d>=0?"+":"") + d.toFixed(1); });
}


export async function syncDynamicAnalysisToPostgres(
  prisma: any,
  qo: Function,
  startDate?: string,
  endDate?: string
) {
  const refDate = startDate ? new Date(startDate.replace(/\//g, "-")) : new Date();
  const xunDate = lastDayOfPreviousXun(refDate);
  const sd = fmt8(xunDate);
  const ed = sd;
  const pm = previousMonthRange(refDate);
  const pd = previousYearDecember();
  const kinds = ['overall-oil','overall-water','single-oil','single-water'];
  // Delete old records before re-syncing to avoid accumulation
  for (const kind of kinds) {
    await prisma.dynamicAnalysisRecord.deleteMany({ where: { kind } });
  }
  console.log('Cleared old dynamic analysis records');
  let total = 0;

  for (const kind of kinds) {
    const isOv = kind.startsWith('overall');
    for (const block of BLOCKS) {
      try {
        const blockSql = buildSql(kind, block.qkdyClause);
        const [cur, mon, yr] = await Promise.all([
          qo(blockSql, { s: sd, e: ed }),
          qo(blockSql, { s: pm.start, e: pm.end }),
          qo(blockSql, { s: pd.start, e: pd.end }),
        ]);

        if (isOv) {
          const curRow = cur.success && cur.rows?.length > 0 ? cur.rows[0] : null;
          const ev = toVals(kind, curRow);
          const av = toVals(kind, mon.success && mon.rows?.length > 0 ? mon.rows[0] : null);
          const yv = toVals(kind, yr.success && yr.rows?.length > 0 ? yr.rows[0] : null);
          await prisma.dynamicAnalysisRecord.create({
            data: {
              kind, unit: block.unit, block: block.name, wellNo: null,
              endValues: ev, averageValues: av, lastYearValues: yv,
              diffMonth: daDiff(ev, av), diffYear: daDiff(ev, yv),
              advice: ['',''], status: null, process: null,
            }
          });
          total++;
        } else {
          const curRows = cur.success ? (cur.rows || []) : [];
          const monMap = new Map((mon.success ? (mon.rows||[]) : []).map((r: any) => [r.JH, r]));
          const yrMap = new Map((yr.success ? (yr.rows||[]) : []).map((r: any) => [r.JH, r]));
          for (const row of curRows) {
            const jh = (row as any).JH;
            const ev = toVals(kind, row);
            const av = toVals(kind, monMap.get(jh) ?? null);
            const yv = toVals(kind, yrMap.get(jh) ?? null);
            await prisma.dynamicAnalysisRecord.create({
              data: {
                kind, unit: block.unit, block: block.name, wellNo: jh,
                endValues: ev, averageValues: av, lastYearValues: yv,
                diffMonth: daDiff(ev, av), diffYear: daDiff(ev, yv),
                advice: ['',''], status: null, process: null,
              }
            });
            total++;
          }
        }
      } catch (e: any) {
        console.error('Sync DA block ' + block.name + ' ' + kind + ':', e?.message);
      }
    }
  }
  return total;
}export function registerDynamicAnalysisOracleRoute(app: any, hasOracle: () => boolean, qo: Function, se: Function) {
  app.get("/api/dynamic-analysis-oracle", async (req: any, res: any) => {
    try {
      if (!hasOracle()) return res.status(503).json({ error: "Oracle not configured" });
      const kind = String(req.query.kind || "overall-oil");
      if (!["overall-oil","overall-water","single-oil","single-water"].includes(kind)) return res.status(400).json({ error: "Invalid kind" });
      const sd = String(req.query.startDate || "2026/04/01");
      const ed = String(req.query.endDate || "2026/04/10");
      const bf = String(req.query.block || "");
      const refDate = new Date(sd.replace(/\//g, "-"));
      const xunDate = lastDayOfPreviousXun(refDate);
      const pm = previousMonthRange(refDate);
      const pd = previousYearDecember();
      const blocks = bf ? BLOCKS.filter(b => b.name === bf) : BLOCKS;
      const isOv = kind.startsWith("overall");
      const rows: Record<string, unknown>[] = [];
      const sdf = fmt8(xunDate);
      const edf = sdf;
      for (const block of blocks) {
        try {
          const sql = buildSql(kind, block.qkdyClause);
          const [cur, mon, yr] = await Promise.all([
            qo(sql, { s: sdf, e: edf }),
            qo(sql, { s: pm.start, e: pm.end }),
            qo(sql, { s: pd.start, e: pd.end }),
          ]);
          if (isOv) {
            const ev = toVals(kind, cur.success ? (cur.rows?.[0] ?? null) : null);
            const av = toVals(kind, mon.success ? (mon.rows?.[0] ?? null) : null);
            const yv = toVals(kind, yr.success ? (yr.rows?.[0] ?? null) : null);
            rows.push({ id: "ora-"+block.name+"-"+kind, kind, unit: block.unit, block: block.name, wellNo: null, endValues: ev, averageValues: av, lastYearValues: yv, diffMonth: daDiff(ev,av), diffYear: daDiff(ev,yv), advice: ["",""], status: null, process: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
          } else {
            const cr = cur.success ? (cur.rows || []) : [];
            const mm = new Map((mon.success ? (mon.rows||[]) : []).map((r: any) => [r.JH, r]));
            const ym = new Map((yr.success ? (yr.rows||[]) : []).map((r: any) => [r.JH, r]));
            for (const row of cr) {
              const jh = (row as any).JH;
              rows.push({ id: "ora-"+jh+"-"+kind, kind, unit: block.unit, block: block.name, wellNo: jh, endValues: toVals(kind,row), averageValues: toVals(kind,mm.get(jh)??null), lastYearValues: toVals(kind,ym.get(jh)??null), diffMonth: daDiff(toVals(kind,row),toVals(kind,mm.get(jh)??null)), diffYear: daDiff(toVals(kind,row),toVals(kind,ym.get(jh)??null)), advice: ["",""], status: null, process: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            }
          }
        } catch (e: any) { console.error("Oracle DA block "+block.name+":", e?.message); }
      }
      res.json({ rows, total: rows.length, page: 1, pageSize: rows.length });
    } catch (e: any) { res.status(500).json({ error: "DA Oracle failed", details: se(e) }); }
  });
}