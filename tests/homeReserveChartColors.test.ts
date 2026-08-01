import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_HOME_RESERVE_CHART_COLORS,
  HOME_RESERVE_CHART_COLORS_CONFIG_KEY,
  parseHomeReserveChartColors,
  serializeHomeReserveChartColors,
} from "../src/shared/homeReserveChartColors";

test("exposes the reserve chart color config key and defaults", () => {
  assert.equal(HOME_RESERVE_CHART_COLORS_CONFIG_KEY, "homeReserveChartColors");
  assert.deepEqual(DEFAULT_HOME_RESERVE_CHART_COLORS, {
    oil: "#EF4444",
    producing: "#2563EB",
    recoverable: "#C026D3",
    recovery: "#486581",
    contribution: "#7F1D1D",
  });
});

test("parses arbitrary valid full-spectrum colors without normalizing their values", () => {
  const colors = {
    oil: "#FFFF00",
    producing: "#00AA00",
    recoverable: "#12ABCD",
    recovery: "#000000",
    contribution: "#ffffff",
  };

  assert.deepEqual(parseHomeReserveChartColors(JSON.stringify(colors)), colors);
});

test("falls back per field for invalid and missing color values", () => {
  assert.deepEqual(
    parseHomeReserveChartColors(
      JSON.stringify({ oil: "red", producing: "#00AA00", recoverable: "#12345" }),
    ),
    {
      oil: DEFAULT_HOME_RESERVE_CHART_COLORS.oil,
      producing: "#00AA00",
      recoverable: DEFAULT_HOME_RESERVE_CHART_COLORS.recoverable,
      recovery: DEFAULT_HOME_RESERVE_CHART_COLORS.recovery,
      contribution: DEFAULT_HOME_RESERVE_CHART_COLORS.contribution,
    },
  );
});

test("returns defaults for absent, malformed, and array JSON values", () => {
  assert.deepEqual(parseHomeReserveChartColors(undefined), DEFAULT_HOME_RESERVE_CHART_COLORS);
  assert.deepEqual(parseHomeReserveChartColors("not-json"), DEFAULT_HOME_RESERVE_CHART_COLORS);
  assert.deepEqual(parseHomeReserveChartColors("[]"), DEFAULT_HOME_RESERVE_CHART_COLORS);
});

test("serializes a complete supplied palette", () => {
  const colors = {
    oil: "#FFFF00",
    producing: "#00AA00",
    recoverable: "#12ABCD",
    recovery: "#000000",
    contribution: "#ffffff",
  };

  assert.deepEqual(JSON.parse(serializeHomeReserveChartColors(colors)), colors);
});
