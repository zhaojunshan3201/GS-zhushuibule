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
  const dashboardLoading = dashboard && getJsxAttribute(dashboard, "loading");
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
    dashboardLoading,
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
  assert.ok(contract.dashboardLoading?.initializer && ts.isJsxExpression(contract.dashboardLoading.initializer));
  assert.equal(contract.dashboardLoading.initializer.expression?.getText(), "loading");
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
  const blockAxis = source.match(/<XAxis\s+[\s\S]*?dataKey="block"[\s\S]*?\/>/)?.[0] ?? "";

  for (const chartPrimitive of ["ComposedChart", "BarChart", "Line"]) {
    assert.match(source, new RegExp(chartPrimitive));
  }
  for (const color of ["#1d4ed8", "#6d28d9", "#b91c1c", "#486581", "#7f1d1d"]) {
    assert.match(source, new RegExp(color));
  }
  assert.match(source, /recovery: "#486581"/);
  assert.match(source, /backgroundColor: CHART_COLORS\.contribution/);
  assert.match(source, /rounded-full bg-slate-100 px-2\.5 py-1/);
  assert.doesNotMatch(source, /bg-teal-700/);
  assert.match(source, /dashboard\.ranking\.map/);
  assert.match(source, /dashboard\.units\.map/);
  assert.match(source, /aria-label=/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /min-w-\[720px\]/);
  assert.doesNotMatch(source, /unit=" 万吨/);
  assert.match(source, /LabelList/);
  assert.match(source, /aria-describedby=/);
  assert.match(blockAxis, /angle=\{0\}/);
  assert.match(blockAxis, /textAnchor="middle"/);
  assert.match(blockAxis, /height=\{44\}/);
  assert.match(blockAxis, /tickMargin=\{12\}/);
  assert.doesNotMatch(blockAxis, /angle=\{-24\}/);
});

test("home reserve analysis dashboard distinguishes loading from an empty result", () => {
  const loadingMarkup = renderToStaticMarkup(createElement(HomeReserveAnalysisDashboard, { rows: [], loading: true }));
  const emptyMarkup = renderToStaticMarkup(createElement(HomeReserveAnalysisDashboard, { rows: [], loading: false }));

  assert.match(loadingMarkup, /正在加载储量分析数据/);
  assert.equal(emptyMarkup, "");
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

test("home reserve ranking renders exact values and accessible non-tooltip context", () => {
  const rows = buildHomeReserveOverviewRows(buildHomeReserveOverviewSeedRows());
  const markup = renderToStaticMarkup(createElement(HomeReserveAnalysisDashboard, { rows }));
  const renderedText = markup.replace(/<[^>]+>/g, "");

  assert.match(renderedText, /牛心坨油层[\s\S]*221\.8 万吨[\s\S]*27\.92%/);
  assert.match(markup, /<ol[^>]+aria-label="区块动用储量精确排名"/);
  assert.match(markup, /aria-describedby="home-reserve-ranking-list"/);
});
