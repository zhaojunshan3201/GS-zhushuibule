import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWellHistoryHtml } from "../src/shared/wellHistoryRichText";

test("removes executable markup from well history rich text", () => {
  const html = sanitizeWellHistoryHtml('<h2>井史</h2><img src="/uploads/well-history/slide.png" onerror="alert(1)"><script>alert(1)</script>');

  assert.match(html, /<h2>井史<\/h2>/);
  assert.doesNotMatch(html, /script|onerror/i);
});
