
app.get("/api/dynamic-analysis-oracle", async (req, res) => {
  try {
    if (!hasOracleConfig()) {
      return res.status(503).json({ error: "Oracle database is not configured" });
    }
    const kind = String(req.query.kind || "overall-oil");
    if (!["overall-oil","overall-water","single-oil","single-water"].includes(kind)) {
      return res.status(400).json({ error: "Invalid kind" });
    }
    const startDate = String(req.query.startDate || "2026/04/01");
    const endDate = String(req.query.endDate || "2026/04/10");
    const blockFilter = String(req.query.block || "");

    const prevMonth = shiftPeriodMonths(startDate, endDate, -1);
    const prevYearDec = getPrevYearDecPeriod(startDate, endDate);

    const isOverall = kind.startsWith("overall");
    const blocks = blockFilter
      ? DYNAMIC_ANALYSIS_BLOCKS.filter(b => b.name === blockFilter)
      : DYNAMIC_ANALYSIS_BLOCKS;

    const sql = daSql(kind);
    type R = Record<string, unknown>;
    const rows: R[] = [];

    for (const block of blocks) {
      try {
        const [cur, mon, yr] = await Promise.all([
          queryOracle<R>(sql, { s: startDate, e: endDate, q: block.qkdyPattern }),
          queryOracle<R>(sql, { s: prevMonth.start, e: prevMonth.end, q: block.qkdyPattern }),
          queryOracle<R>(sql, { s: prevYearDec.start, e: prevYearDec.end, q: block.qkdyPattern }),
        ]);

        if (isOverall) {
          const ev = daRowToValues(kind, cur.success ? (cur.rows?.[0] ?? null) : null);
          const av = daRowToValues(kind, mon.success ? (mon.rows?.[0] ?? null) : null);
          const yv = daRowToValues(kind, yr.success ? (yr.rows?.[0] ?? null) : null);
          rows.push({
            id: "ora-" + block.name + "-" + kind, kind, unit: block.unit, block: block.name,
            wellNo: null, endValues: ev, averageValues: av, lastYearValues: yv,
            diffMonth: daDiff(ev, av), diffYear: daDiff(ev, yv),
            advice: ["",""], status: null, process: null,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          });
        } else {
          const curRows = cur.success ? (cur.rows || []) : [];
          const monMap = new Map((mon.success ? (mon.rows || []) : []).map((r: any) => [r.JH, r]));
          const yrMap = new Map((yr.success ? (yr.rows || []) : []).map((r: any) => [r.JH, r]));
          for (const row of curRows) {
            const jh = (row as any).JH;
            const ev = daRowToValues(kind, row);
            const av = daRowToValues(kind, monMap.get(jh) ?? null);
            const yv = daRowToValues(kind, yrMap.get(jh) ?? null);
            rows.push({
              id: "ora-" + jh + "-" + kind, kind, unit: block.unit, block: block.name,
              wellNo: jh, endValues: ev, averageValues: av, lastYearValues: yv,
              diffMonth: daDiff(ev, av), diffYear: daDiff(ev, yv),
              advice: ["",""], status: null, process: null,
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            });
          }
        }
      } catch (err: any) {
        console.error("Oracle DA query failed for block " + block.name + ":", err?.message);
      }
    }
    res.json({ rows, total: rows.length, page: 1, pageSize: rows.length });
  } catch (error: any) {
    res.status(500).json({ error: "Dynamic analysis Oracle query failed", details: serializeError(error) });
  }
});
