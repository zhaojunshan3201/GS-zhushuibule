import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import {
  formatChartTooltipValue,
  HomeReserveAnalysisDashboard,
} from "../src/components/HomeReserveAnalysisDashboard";
import {
  buildHomeReserveOverviewRows,
  buildHomeReserveOverviewSeedRows,
} from "../src/shared/homeReserveOverview";

const componentUrl = new URL("../src/components/HomeReserveAnalysisDashboard.tsx", import.meta.url);
const appUrl = new URL("../src/App.tsx", import.meta.url);

function descendants(node: ts.Node) {
  const nodes: ts.Node[] = [];
  const visit = (child: ts.Node) => {
    nodes.push(child);
    child.forEachChild(visit);
  };
  node.forEachChild(visit);
  return nodes;
}

function getJsxAttribute(opening: ts.JsxOpeningLikeElement, name: string) {
  return opening.attributes.properties.find(
    (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

function inspectHomePageIntegration(source: string) {
  const ast = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const homePage = ast.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "HomePage",
  );
  assert.ok(homePage?.body, "HomePage function must exist");
  const homeNodes = descendants(homePage);

  const hasDashboardImport = ast.statements.some((statement) =>
    ts.isImportDeclaration(statement) &&
    ts.isStringLiteral(statement.moduleSpecifier) &&
    statement.moduleSpecifier.text === "./components/HomeReserveAnalysisDashboard" &&
    statement.importClause?.namedBindings &&
    ts.isNamedImports(statement.importClause.namedBindings) &&
    statement.importClause.namedBindings.elements.some((element) => element.name.text === "HomeReserveAnalysisDashboard"),
  );
  const dashboard = homeNodes.find(
    (node): node is ts.JsxSelfClosingElement =>
      ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "HomeReserveAnalysisDashboard",
  );
  const dashboardRows = dashboard && getJsxAttribute(dashboard, "rows");
  const section = homeNodes.find(
    (node): node is ts.JsxElement => ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "section",
  );
  const heading = homeNodes.find(
    (node): node is ts.JsxElement => ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "h2",
  );
  const sectionLabel = section && getJsxAttribute(section.openingElement, "aria-labelledby");
  const headingId = heading && getJsxAttribute(heading.openingElement, "id");
  const tableHead = homeNodes.find(
    (node): node is ts.JsxElement => ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "thead",
  );
  const headers = tableHead && descendants(tableHead).find(
    (node): node is ts.ArrayLiteralExpression =>
      ts.isArrayLiteralExpression(node) && node.elements.length === 7 && node.elements.every(ts.isStringLiteral),
  );

  return {
    dashboard,
    dashboardRows,
    hasDashboardImport,
    hasApiPath: homeNodes.some((node) => ts.isStringLiteral(node) && node.text === "/api/home-reserve-overview"),
    heading,
    headingId,
    headingText: heading?.children.filter(ts.isJsxText).map((node) => node.text.trim()).join(""),
    headers: headers?.elements.map((element) => (element as ts.StringLiteral).text),
    sectionLabel,
  };
}

test("home page integration inspection rejects a missing dashboard node", async () => {
  const source = await readFile(appUrl, "utf8");
  const contract = inspectHomePageIntegration(source);
  assert.ok(contract.dashboard);
  const withoutDashboard = `${source.slice(0, contract.dashboard.getStart())}${source.slice(contract.dashboard.getEnd())}`;

  assert.equal(inspectHomePageIntegration(withoutDashboard).dashboard, undefined);
});

test("home page places the reserve dashboard above the unchanged overview table", async () => {
  const contract = inspectHomePageIntegration(await readFile(appUrl, "utf8"));

  assert.equal(contract.hasDashboardImport, true);
  assert.ok(contract.dashboard, "HomePage must render HomeReserveAnalysisDashboard");
  assert.ok(contract.heading, "HomePage must render the reserve table heading");
  assert.ok(contract.dashboard.getStart() < contract.heading.getStart(), "dashboard must precede the reserve table heading");
  assert.ok(contract.dashboardRows?.initializer && ts.isJsxExpression(contract.dashboardRows.initializer));
  assert.equal(contract.dashboardRows.initializer.expression?.getText(), "rows");
  assert.ok(contract.sectionLabel?.initializer && ts.isStringLiteral(contract.sectionLabel.initializer));
  assert.equal(contract.sectionLabel.initializer.text, "reserve-table-title");
  assert.ok(contract.headingId?.initializer && ts.isStringLiteral(contract.headingId.initializer));
  assert.equal(contract.headingId.initializer.text, "reserve-table-title");
  assert.equal(contract.headingText, "储量概览列表");
  assert.equal(contract.hasApiPath, true);
  assert.deepEqual(contract.headers, ["单位", "区块", "含油面积", "动用储量", "可采储量", "标定采收率", "上年度产油"]);
});

test("home reserve analysis dashboard exposes the requested analytics content", async () => {
  const source = await readFile(componentUrl, "utf8");

  assert.match(source, /export function HomeReserveAnalysisDashboard/);
  assert.match(source, /储量分析看板/);
  assert.match(source, /buildHomeReserveDashboardData/);
  for (const metric of ["动用储量", "可采储量", "标定采收率", "上年度产油"]) {
    assert.match(source, new RegExp(metric));
  }
});

test("home reserve analysis dashboard includes accessible, consistently colored charts", async () => {
  const source = await readFile(componentUrl, "utf8");

  for (const chartPrimitive of ["ComposedChart", "BarChart", "Line"]) {
    assert.match(source, new RegExp(chartPrimitive));
  }
  for (const color of ["#0f766e", "#d99545", "#486581"]) {
    assert.match(source, new RegExp(color));
  }
  assert.match(source, /dashboard\.ranking\.map/);
  assert.match(source, /dashboard\.units\.map/);
  assert.match(source, /aria-label=/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /min-w-\[720px\]/);
  assert.doesNotMatch(source, /unit=" 万吨/);
});

test("home reserve analysis dashboard renders nothing without rows", () => {
  const markup = renderToStaticMarkup(createElement(HomeReserveAnalysisDashboard, { rows: [] }));

  assert.equal(markup, "");
});

test("home reserve analysis dashboard renders accurate totals and unit contributions", () => {
  const rows = buildHomeReserveOverviewRows(buildHomeReserveOverviewSeedRows());
  const markup = renderToStaticMarkup(createElement(HomeReserveAnalysisDashboard, { rows }));
  const renderedText = markup.replace(/<[^>]+>/g, "");

  for (const value of ["794.5", "184.6", "23.23%", "25.55", "采一", "44.72%", "采二", "55.28%"]) {
    assert.match(renderedText, new RegExp(value));
  }
});

test("home reserve chart tooltip values use one precise unit suffix", () => {
  assert.equal(formatChartTooltipValue(794.5, "reserve"), "794.5 万吨");
  assert.equal(formatChartTooltipValue(25.55, "oil"), "25.55 万吨/年");
  assert.equal(formatChartTooltipValue(44.72, "percent"), "44.72%");
});
