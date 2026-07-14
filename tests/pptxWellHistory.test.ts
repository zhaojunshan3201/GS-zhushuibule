import assert from "node:assert/strict";
import test from "node:test";
import { applyPptxEdit } from "../src/shared/pptxWellHistory";

test("does not delete the last PPTX slide", () => {
  const document = {
    slides: [{ id: "slide1", path: "ppt/slides/slide1.xml", xml: "<p:sld/>", elements: [] }],
    source: new Uint8Array(),
    dirty: false,
  };

  assert.equal(applyPptxEdit(document, { type: "delete-slide", slideId: "slide1" }).slides.length, 1);
});
