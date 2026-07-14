# Read current server.ts
t = open(r"C:\ZS\gszhushuiSQL\server.ts", "r", encoding="utf-8").read()

# === PATCH 1: Add import after oracledb import ===
old_import = 'import oracledb from "oracledb";'
new_import = 'import oracledb from "oracledb";\nimport { registerDynamicAnalysisOracleRoute, syncDynamicAnalysisToPostgres } from "./oracle-dynamic-analysis";'
if old_import in t and 'oracle-dynamic-analysis' not in t:
    t = t.replace(old_import, new_import)
    print("Patch 1 applied: import added")
else:
    print("Patch 1 skip: already present or not found")

# === PATCH 2: Non-blocking startup + sync ===
old_startup = '  await scheduleSnapshotRefreshes();'
new_startup = '  scheduleSnapshotRefreshes().catch((e) => console.error("Snapshot refresh failed:", e));\n  syncDynamicAnalysisToPostgres(prisma, queryOracle).then(() => console.log("Dynamic analysis synced")).catch((e) => console.error("Dynamic analysis sync failed:", e));'
if old_startup in t:
    t = t.replace(old_startup, new_startup)
    print("Patch 2 applied: non-blocking startup")
else:
    print("Patch 2 skip: pattern not found")

# === PATCH 3: seed + sync endpoints after DELETE endpoint ===
old_endpoint_marker = 'app.get("/api/well-measures", async (req, res) => {'
if old_endpoint_marker in t and 'dynamic-analysis-seed' not in t:
    seed_sync_endpoints = '''app.post("/api/dynamic-analysis-seed", async (req, res) => {
  try {
    const kinds = ["overall-oil","overall-water","single-oil","single-water"];
    for (const k of kinds) {
      await prisma.dynamicAnalysisRecord.deleteMany({ where: { kind: k } });
    }

    const blocks = [
      { unit: "高采采油作业一区", name: "雷家L", oil: ["22","18","260","21","91.8"], water: ["9","7","140"] },
      { unit: "高采采油作业一区", name: "雷家D", oil: ["23","20","260","21","92.0"], water: ["9","8","140"] },
      { unit: "高采采油作业二区", name: "雷64水驱", oil: ["32","28","380","30","92.1"], water: ["12","10","195"] },
      { unit: "高采采油作业二区", name: "雷72", oil: ["28","24","310","25","91.5"], water: ["10","8","160"] },
      { unit: "高采采油作业一区", name: "牛心坨N1-3", oil: ["30","26","350","28","91.6"], water: ["12","10","180"] },
      { unit: "高采采油作业一区", name: "牛心坨潜山", oil: ["25","22","330","27","91.2"], water: ["10","8","170"] },
      { unit: "高采采油作业三区", name: "坨33", oil: ["42","36","510","41","91.6"], water: ["16","14","260"] },
    ];

    const sampleWells = [
      { unit: "高采采油作业一区", block: "雷家L", wells: ["雷29-22","雷30-13","雷29-15"] },
      { unit: "高采采油作业一区", block: "雷家D", wells: ["雷25-9C","雷25-15"] },
      { unit: "高采采油作业二区", block: "雷64水驱", wells: ["雷64-26-20","雷64-28-22"] },
      { unit: "高采采油作业一区", block: "牛心坨N1-3", wells: ["坨38-34","坨38-033"] },
    ];

    function makeDiff(cur: string[], prev: string[]) {
      return cur.map((v,i) => {
        const d = parseFloat(v) - parseFloat(prev[i]||"0");
        return (d>=0?"+":"") + d.toFixed(1);
      });
    }

    let total = 0;

    for (const b of blocks) {
      const oil = b.oil;
      const oilPrev = oil.map(v => String(Math.max(0, parseFloat(v) - 2 - Math.random() * 3).toFixed(1)));
      const oilYear = oil.map(v => String(Math.max(0, parseFloat(v) - 3 - Math.random() * 5).toFixed(1)));
      await prisma.dynamicAnalysisRecord.create({ data: {
        kind: "overall-oil", unit: b.unit, block: b.name, wellNo: null,
        endValues: oil, averageValues: oilPrev, lastYearValues: oilYear,
        diffMonth: makeDiff(oil, oilPrev), diffYear: makeDiff(oil, oilYear),
        advice: ["",""], status: null, process: null,
      }});
      const wat = b.water;
      const watPrev = wat.map(v => String(Math.max(0, parseFloat(v) - 1 - Math.random() * 2).toFixed(1)));
      const watYear = wat.map(v => String(Math.max(0, parseFloat(v) - 2 - Math.random() * 3).toFixed(1)));
      await prisma.dynamicAnalysisRecord.create({ data: {
        kind: "overall-water", unit: b.unit, block: b.name, wellNo: null,
        endValues: wat, averageValues: watPrev, lastYearValues: watYear,
        diffMonth: makeDiff(wat, watPrev), diffYear: makeDiff(wat, watYear),
        advice: ["",""], status: null, process: null,
      }});
      total += 2;
    }

    for (const g of sampleWells) {
      for (const well of g.wells) {
        const oilVals = [String((8 + Math.random() * 15).toFixed(1)), String((1 + Math.random() * 3).toFixed(1)), String((88 + Math.random() * 8).toFixed(1))];
        const oilPrev = oilVals.map(v => String(Math.max(0, parseFloat(v) - 1 - Math.random()).toFixed(1)));
        const oilYear = oilVals.map(v => String(Math.max(0, parseFloat(v) - 2 - Math.random() * 2).toFixed(1)));
        await prisma.dynamicAnalysisRecord.create({ data: {
          kind: "single-oil", unit: g.unit, block: g.block, wellNo: well,
          endValues: oilVals, averageValues: oilPrev, lastYearValues: oilYear,
          diffMonth: makeDiff(oilVals, oilPrev), diffYear: makeDiff(oilVals, oilYear),
          advice: ["",""], status: null, process: null,
        }});
        const watVals = [String((20 + Math.random() * 30).toFixed(1)), String((5 + Math.random() * 3).toFixed(1)), String((3 + Math.random() * 5).toFixed(1))];
        const watPrev = watVals.map(v => String(Math.max(0, parseFloat(v) - 1 - Math.random()).toFixed(1)));
        const watYear = watVals.map(v => String(Math.max(0, parseFloat(v) - 2 - Math.random()).toFixed(1)));
        await prisma.dynamicAnalysisRecord.create({ data: {
          kind: "single-water", unit: g.unit, block: g.block, wellNo: well,
          endValues: watVals, averageValues: watPrev, lastYearValues: watYear,
          diffMonth: makeDiff(watVals, watPrev), diffYear: makeDiff(watVals, watYear),
          advice: ["",""], status: null, process: null,
        }});
        total += 2;
      }
    }

    res.json({ ok: true, total });
  } catch (e: any) { res.status(500).json({ error: "Seed failed", details: serializeError(e) }); }
});

app.post("/api/dynamic-analysis-sync", async (req, res) => {
  try {
    if (!hasOracleConfig()) return res.status(503).json({ error: "Oracle not configured" });
    const sd = String(req.query.startDate || "");
    const ed = String(req.query.endDate || "");
    await syncDynamicAnalysisToPostgres(prisma, queryOracle, sd || undefined, ed || undefined);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "Sync failed", details: serializeError(e) }); }
});

'''
    t = t.replace(old_endpoint_marker, seed_sync_endpoints + old_endpoint_marker)
    print("Patch 3 applied: seed/sync endpoints")
else:
    print("Patch 3 skip: already present or marker not found")

# Write back
open(r"C:\ZS\gszhushuiSQL\server.ts", "w", encoding="utf-8").write(t)
print("All patches applied, file written")