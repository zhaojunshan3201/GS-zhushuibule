with open(r"C:\ZS\gszhushuiSQL\server.ts", "r", encoding="utf-8") as f:
    t = f.read()

# Find the sampleWells section and replace with separate oil/water wells
old_wells = '''    const sampleWells = [
      { unit: "高采采油作业一区", block: "雷家L", wells: ["雷29-22","雷30-13","雷29-15"] },
      { unit: "高采采油作业一区", block: "雷家D", wells: ["雷25-9C","雷25-15"] },
      { unit: "高采采油作业二区", block: "牛心坨N1-3", wells: ["坨38-34","坨38-033"] },
      { unit: "高采采油作业二区", block: "坨33", wells: ["坨33-29","坨33-34-30"] },
      { unit: "高采采油作业三区", block: "高10", wells: ["高10-1","高10-2"] },
      { unit: "高采采油作业三区", block: "246块L5", wells: ["高2-4-6","高2-5-05"] },
    ];'''

new_wells = '''    const oilSampleWells = [
      { unit: "高采采油作业一区", block: "雷家L", wells: ["雷29-22","雷30-13","雷29-15"] },
      { unit: "高采采油作业一区", block: "雷家D", wells: ["雷25-9C","雷25-15"] },
      { unit: "高采采油作业二区", block: "牛心坨N1-3", wells: ["坨38-34","坨38-033"] },
      { unit: "高采采油作业二区", block: "坨33", wells: ["坨33-29","坨33-34-30"] },
      { unit: "高采采油作业三区", block: "高10", wells: ["高10-1","高10-2"] },
      { unit: "高采采油作业三区", block: "246块L5", wells: ["高2-4-6","高2-5-05"] },
    ];
    const waterSampleWells = [
      { unit: "高采采油作业一区", block: "雷家L", wells: ["雷29-22","雷29-15"] },
      { unit: "高采采油作业一区", block: "雷64水驱", wells: ["雷64-26-20","雷64-28-22"] },
      { unit: "高采采油作业二区", block: "牛心坨N1-3", wells: ["坨38-34","坨38-033"] },
      { unit: "高采采油作业二区", block: "坨33", wells: ["坨33-29","坨33-34-30"] },
      { unit: "高采采油作业三区", block: "高10", wells: ["高10-1","高10-2"] },
      { unit: "高采采油作业三区", block: "246块L5", wells: ["高2-4-6","高2-5-05"] },
    ];'''

if old_wells in t:
    t = t.replace(old_wells, new_wells)
    print("sampleWells replaced")
else:
    print("NOT FOUND")

# Now update the loop that creates single records
# Change: for (const g of sampleWells) { ... creates BOTH single-oil and single-water ... }
# To: for (const g of oilSampleWells) { create single-oil } + for (const g of waterSampleWells) { create single-water }

old_loop = '''    for (const g of sampleWells) {
      for (const well of g.wells) {
        const oilVals'''
new_loop = '''    for (const g of oilSampleWells) {
      for (const well of g.wells) {
        const oilVals'''

if old_loop in t:
    t = t.replace(old_loop, new_loop)
    print("oil loop fixed")
else:
    print("oil loop NOT FOUND")

# Now find the water part and change sampleWells -> waterSampleWells
old_water_loop = '''        const watVals = [String((20 + Math.random() * 30).toFixed(1)), String((5 + Math.random() * 3).toFixed(1)), String((3 + Math.random() * 5).toFixed(1))];
        const watPrev = watVals.map(v => String(Math.max(0, parseFloat(v) - 1 - Math.random()).toFixed(1)));
        const watYear = watVals.map(v => String(Math.max(0, parseFloat(v) - 2 - Math.random()).toFixed(1)));
        await prisma.dynamicAnalysisRecord.create({ data: {
          kind: "single-water", unit: g.unit, block: g.block, wellNo: well,'''

new_water_loop = '''      }
    }
    for (const g of waterSampleWells) {
      for (const well of g.wells) {
        const watVals = [String((20 + Math.random() * 30).toFixed(1)), String((5 + Math.random() * 3).toFixed(1)), String((3 + Math.random() * 5).toFixed(1))];
        const watPrev = watVals.map(v => String(Math.max(0, parseFloat(v) - 1 - Math.random()).toFixed(1)));
        const watYear = watVals.map(v => String(Math.max(0, parseFloat(v) - 2 - Math.random()).toFixed(1)));
        await prisma.dynamicAnalysisRecord.create({ data: {
          kind: "single-water", unit: g.unit, block: g.block, wellNo: well,'''

if old_water_loop in t:
    t = t.replace(old_water_loop, new_water_loop)
    print("water loop fixed")
else:
    print("water loop NOT FOUND")

with open(r"C:\ZS\gszhushuiSQL\server.ts", "w", encoding="utf-8") as f:
    f.write(t)

print("Done")