const fs = require("fs");
const p = "C:/ZS/gszhushuiSQL/src/App.tsx";
let c = fs.readFileSync(p, "utf8");

c = c.replace(
  "const apiSingleOilYearRows = singleOilYearRecords.map(toSingleRow);",
  "const apiSingleOilYearRows = singleOilYearRecords.map(toSingleRow).sort((a, b) => parseFloat(a.diffYear[0]) - parseFloat(b.diffYear[0]));"
);

fs.writeFileSync(p, c, "utf8");
console.log("Done");
