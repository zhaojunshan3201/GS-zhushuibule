import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const appUrl = new URL("../src/App.tsx", import.meta.url);

function getFunctionSource(source: string, functionName: string) {
  const ast = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const page = ast.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === functionName,
  );

  assert.ok(page, `${functionName} function must exist`);
  return source.slice(page.getStart(ast), page.getEnd());
}

for (const pageName of [
  "ConcentricTestHistoryPage",
  "SmartTestHistoryPage",
  "SingleWellInjectionEvaluationPage",
  "SingleWellSealEvaluationPage",
]) {
  test(`${pageName} uses shared adaptive server pagination`, async () => {
    const pageSource = getFunctionSource(await readFile(appUrl, "utf8"), pageName);

    assert.match(pageSource, /useAdaptiveTablePagination\s*\(/);
    assert.match(pageSource, /pageSize\s*:\s*requestedPageSize/);
    assert.match(pageSource, /const\s+loadRequestIdRef\s*=\s*useRef\(0\)/);
    assert.match(pageSource, /ref=\{tablePageRef\}/);
    assert.doesNotMatch(pageSource, /const\s+pageSize\s*=\s*(?:10|15|30)\b/);
  });
}
