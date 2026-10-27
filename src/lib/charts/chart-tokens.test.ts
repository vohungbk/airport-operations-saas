import { describe, expect, it } from "vitest";

import {
  CHART_COLORS,
  CHART_GRID_COLOR,
  SERIES_MARKERS,
  seriesColor,
  seriesMarker,
  seriesPattern,
} from "@/lib/charts/chart-tokens";

describe("chart tokens", () => {
  it("should name the six chart tokens and the grid token, never a color", () => {
    expect(CHART_COLORS).toEqual([
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
      "var(--chart-6)",
    ]);
    expect(CHART_GRID_COLOR).toBe("var(--chart-grid)");
  });

  it("should give each of the first six series its own color", () => {
    expect(new Set([0, 1, 2, 3, 4, 5].map(seriesColor)).size).toBe(6);
  });

  it("should start the colors again after the sixth series", () => {
    expect(seriesColor(6)).toBe(seriesColor(0));
  });

  it("should not fail on a negative index", () => {
    expect(seriesColor(-1)).toBe("var(--chart-6)");
  });

  it("should tell neighbouring series apart by pattern as well as color", () => {
    for (let i = 0; i < 11; i += 1) {
      expect(seriesPattern(i)).not.toBe(seriesPattern(i + 1));
    }
  });

  it("should not give the seventh series the look of the first", () => {
    expect(seriesColor(6)).toBe(seriesColor(0));
    expect(seriesPattern(6)).not.toBe(seriesPattern(0));
  });

  it("should give each of the first six series its own marker", () => {
    expect(new Set([0, 1, 2, 3, 4, 5].map(seriesMarker)).size).toBe(SERIES_MARKERS.length);
  });
});
