import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { isAetheraLandingLocation } from "../src/shared/aetheraLanding";

const mainSource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

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
    (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) && node.openingElement.tagName.getText(sourceFile) === name;

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
