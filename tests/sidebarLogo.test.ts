import assert from "node:assert/strict";
import test from "node:test";
import { applySidebarLogoLoad, applySidebarLogoUpdate, isCurrentSidebarLogoUpload } from "../src/shared/sidebarLogo";

test("a sidebar logo event wins over an earlier config request", () => {
  const loadingState = { url: "", version: 0 };
  const eventState = applySidebarLogoUpdate(loadingState, "/uploads/system/new-logo.png");

  assert.deepEqual(eventState, { url: "/uploads/system/new-logo.png", version: 1 });
  assert.deepEqual(
    applySidebarLogoLoad(eventState, 0, "/uploads/system/old-logo.png"),
    eventState,
  );
});

test("a config request updates the logo when no newer event exists", () => {
  assert.deepEqual(
    applySidebarLogoLoad({ url: "", version: 0 }, 0, "/uploads/system/initial-logo.png"),
    { url: "/uploads/system/initial-logo.png", version: 0 },
  );
});

test("a later sidebar logo selection prevents an earlier upload from persisting", () => {
  const uploadA = 1;
  const uploadB = 2;

  assert.equal(isCurrentSidebarLogoUpload(uploadA, uploadB), false);
  assert.equal(isCurrentSidebarLogoUpload(uploadB, uploadB), true);
});
