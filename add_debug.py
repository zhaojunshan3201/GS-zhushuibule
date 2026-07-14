import os
os.chdir(r"C:\ZS\gszhushuiSQL")

debug_code = '''app.get("/api/debug-final", async (req, res) => {
  try {
    const r = await queryOracle("SELECT COUNT(*) AS CNT FROM dba01 a, daa01 c WHERE a.jh=c.jh AND a.rq>=:s AND a.rq<=:e AND c.qkdy = '??L'", {s:"20250101",e:"20250610"});
    const r2 = await queryOracle("SELECT COUNT(*) AS CNT FROM dba01 a, daa01 c WHERE a.jh=c.jh AND a.rq>=:s AND a.rq<=:e", {s:"20250101",e:"20250610"});
    res.json({ withQkdy: r, withoutQkdy: r2 });
  } catch(e) { res.status(500).json({error:String(e)}); }
});'''

with open("server.ts", "r", encoding="utf-8") as f:
    content = f.read()

marker = 'app.get("/api/well-measures"'
content = content.replace(marker, debug_code + "\n\n" + marker)

with open("server.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("OK")
