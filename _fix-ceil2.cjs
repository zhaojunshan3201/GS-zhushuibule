const fs = require("fs");
const p = "C:/ZS/gszhushuiSQL/oracle-dynamic-analysis.ts";
let lines = fs.readFileSync(p, "utf8").split(/\r?\n/);

// Replace lines 97-98 (0-indexed: 96-97)
let found = false;
for (let i = 0; i < lines.length - 1; i++) {
  if (lines[i].includes('if (kind === "overall-oil") return [r("V0"),r("V1"),r("V2"),r("V3"),r("V5")];') &&
      lines[i+1].includes('if (kind === "overall-water") return [r("V0"),r("V1"),r("V2")];')) {
    lines[i] = '  const ceilInt = (v: string) => { const n = parseFloat(v); return isNaN(n) ? v : String(Math.ceil(n)); };';
    lines[i+1] = '  if (kind === "overall-oil") return [ceilInt(r("V0")),ceilInt(r("V1")),r("V2"),r("V3"),r("V5")];';
    // Insert the water line after
    lines.splice(i+2, 0, '  if (kind === "overall-water") return [ceilInt(r("V0")),ceilInt(r("V1")),r("V2")];');
    found = true;
    console.log("Fixed lines " + (i+1) + "-" + (i+2));
    break;
  }
}
if (!found) console.log("NOT FOUND - checking lines...");
fs.writeFileSync(p, lines.join("\r\n"), "utf8");
