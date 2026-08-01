export type HomeReserveChartColors = {
  oil: string;
  producing: string;
  recoverable: string;
  recovery: string;
  contribution: string;
};

export const HOME_RESERVE_CHART_COLORS_CONFIG_KEY = "homeReserveChartColors";

export const DEFAULT_HOME_RESERVE_CHART_COLORS: HomeReserveChartColors = {
  oil: "#EF4444",
  producing: "#2563EB",
  recoverable: "#C026D3",
  recovery: "#486581",
  contribution: "#7F1D1D",
};

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

function normalizeHomeReserveChartColors(value: unknown): HomeReserveChartColors {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const read = (key: keyof HomeReserveChartColors) => {
    const candidate = source[key];
    return isHexColor(candidate) ? candidate : DEFAULT_HOME_RESERVE_CHART_COLORS[key];
  };

  return {
    oil: read("oil"),
    producing: read("producing"),
    recoverable: read("recoverable"),
    recovery: read("recovery"),
    contribution: read("contribution"),
  };
}

export function parseHomeReserveChartColors(value: string | null | undefined): HomeReserveChartColors {
  if (!value) return { ...DEFAULT_HOME_RESERVE_CHART_COLORS };
  try {
    return normalizeHomeReserveChartColors(JSON.parse(value));
  } catch {
    return { ...DEFAULT_HOME_RESERVE_CHART_COLORS };
  }
}

export function serializeHomeReserveChartColors(colors: HomeReserveChartColors): string {
  return JSON.stringify(colors);
}
