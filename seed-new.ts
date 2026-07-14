app.post("/api/dynamic-analysis-seed", async (req, res) => {
  try {
    const kinds = ["overall-oil","overall-water","single-oil","single-water"];
    for (const k of kinds) {
      await prisma.dynamicAnalysisRecord.deleteMany({ where: { kind: k } });
    }

    const blocks = [
      { unit: "??????", name: "?11", oil: ["45","38","520","42","91.9"], water: ["18","15","280"] },
      { unit: "??????", name: "?64", oil: ["32","28","380","30","92.1"], water: ["12","10","195"] },
      { unit: "??????", name: "?72", oil: ["28","24","310","25","91.5"], water: ["10","8","160"] },
      { unit: "??????", name: "?????", oil: ["55","48","680","55","91.8"], water: ["22","18","350"] },
      { unit: "??????", name: "?????", oil: ["38","32","450","38","91.2"], water: ["15","12","240"] },
      { unit: "??????", name: "?33", oil: ["42","36","510","41","91.6"], water: ["16","14","260"] },
    ];

    const sampleWells = [
      { unit: "??????", block: "?11", wells: ["?29-22","?30-13","?29-15"] },
      { unit: "??????", block: "?64", wells: ["?64-26-20","?64-28-22"] },
      { unit: "??????", block: "?????", wells: ["?38-34","?38-033"] },
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
