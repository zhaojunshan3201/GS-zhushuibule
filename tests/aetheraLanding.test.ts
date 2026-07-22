import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { isAetheraLandingLocation } from "../src/shared/aetheraLanding";
import { getPageFromSearch } from "../src/shared/systemPage";

const mainSource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const indexStyles = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("recognizes Aethera landing locations without business-page search parameters", () => {
  assert.equal(isAetheraLandingLocation("/", ""), true);
  assert.equal(isAetheraLandingLocation("/aethera", ""), true);
  assert.equal(isAetheraLandingLocation("/", "?page=home"), false);
  assert.equal(isAetheraLandingLocation("/", "?page=water-cut"), false);
  assert.equal(isAetheraLandingLocation("/aethera", "?page=home"), false);
  assert.equal(isAetheraLandingLocation("/aethera/", ""), false);
  assert.equal(isAetheraLandingLocation("/unknown", ""), false);
});

test("renders Aethera before the business application", () => {
  assert.match(mainSource, /import AetheraLandingPage from ['"]\.\/components\/AetheraLandingPage\.tsx['"];/);
  const sourceFile = ts.createSourceFile("main.tsx", mainSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let rendersAetheraInsteadOfApp = false;

  const isComponent = (node: ts.Expression, name: string) =>
    (ts.isJsxSelfClosingElement(node) && node.tagName.getText(sourceFile) === name) ||
    (ts.isJsxElement(node) && node.openingElement.tagName.getText(sourceFile) === name);

  const visit = (node: ts.Node) => {
    if (ts.isConditionalExpression(node) &&
      node.condition.getText(sourceFile).replace(/\s/g, "") === "isAetheraLandingLocation(window.location.pathname,window.location.search)" &&
      isComponent(node.whenTrue, "AetheraLandingPage") &&
      isComponent(node.whenFalse, "App")) {
      rendersAetheraInsteadOfApp = true;
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  assert.equal(rendersAetheraInsteadOfApp, true);
});

test("ships the Aethera business landing links and oilfield asset", () => {
  const componentPath = new URL("../src/components/AetheraLandingPage.tsx", import.meta.url);
  assert.equal(existsSync(componentPath), true);
  const landingSource = readFileSync(componentPath, "utf8");

  assert.match(landingSource, />进入注水管理系统<\/a>/);
  assert.ok(landingSource.includes('<a href="/?page=home"'));
  assert.match(landingSource, /\/aethera\/oilfield-river\.png/);
  assert.equal(readFileSync(new URL("../public/aethera/oilfield-river.png", import.meta.url)).byteLength > 0, true);
  assert.ok(indexStyles.indexOf('@import "./styles/fonts.css";') < indexStyles.indexOf('@import "tailwindcss";'));
  assert.ok(indexStyles.indexOf('@import "./styles/theme.css";') > indexStyles.indexOf('@import "tailwindcss";'));
});

test("derives Aethera navigation labels from the system route configuration", () => {
  const landingSource = readFileSync(new URL("../src/components/AetheraLandingPage.tsx", import.meta.url), "utf8");

  assert.match(landingSource, /import \{ ROUTE_CONFIG_BY_ID, type PageType \} from "\.\.\/constants";/);
  assert.match(landingSource, /const navigationPageIds: PageType\[\] = \["home", "dynamic-analysis", "well-history", "water-cut"\];/);
  assert.match(landingSource, /label: ROUTE_CONFIG_BY_ID\[page\]\.label/);
  assert.match(landingSource, /href: `\/\?page=\$\{page\}`/);
});

test("resolves landing links to the corresponding system menu pages", () => {
  assert.equal(getPageFromSearch("?page=dynamic-analysis"), "dynamic-analysis");
  assert.equal(getPageFromSearch("?page=well-history"), "well-history");
  assert.equal(getPageFromSearch("?page=water-cut"), "water-cut");
  assert.equal(getPageFromSearch("?page=unknown"), "home");
});
