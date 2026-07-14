import json
code = '''
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.dynamicAnalysisRecord.updateMany({
  where: {},
  data: { unit: "高采采油作业一区" }
}).then(r => console.log("updated:", r.count))
  .finally(() => p.\());
'''
open(r"C:\ZS\gszhushuiSQL\_update_unit.cjs", "w", encoding="utf-8").write(code)
print("script written")