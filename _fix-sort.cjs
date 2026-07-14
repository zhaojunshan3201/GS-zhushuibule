const fs = require("fs");
const p = "C:/ZS/gszhushuiSQL/src/App.tsx";
let c = fs.readFileSync(p, "utf8");

// Sort apiSingleOilMonthRows by liquid diff (diffMonth[0]) ascending
c = c.replace(
  "const apiSingleOilMonthRows = singleOilMonthRecords.map(toSingleRow);",
  "const apiSingleOilMonthRows = singleOilMonthRecords.map(toSingleRow).sort((a, b) => parseFloat(a.diffMonth[0]) - parseFloat(b.diffMonth[0]));"
);

fs.writeFileSync(p, c, "utf8");
console.log("Sorted by liquid diff ascending");
