import { describe, expect, it } from "vitest";

import {
  MIN_CHART_HEIGHT,
  SCROLL_AFTER_HEIGHT,
  barChartHeight,
  describeBars,
  describeStacks,
  labelColumnWidth,
  maxLabelLines,
  needsScroll,
  toStackRows,
  wrapLabel,
} from "@/lib/charts/bar-data";
import type { ChartSeries } from "@/lib/charts/chart-data";

describe("wrapLabel", () => {
  it("should keep a short label on one line", () => {
    expect(wrapLabel("Available")).toEqual(["Available"]);
  });

  it("should wrap a long label at spaces", () => {
    expect(wrapLabel("Awaiting technician assignment", 18)).toEqual(["Awaiting", "technician", "assignment"]);
  });

  it("should fill a line before it wraps", () => {
    expect(wrapLabel("In use by a partner today", 12)).toEqual(["In use by a", "partner", "today"]);
  });

  it("should cut a word that is longer than a line, without losing text", () => {
    const lines = wrapLabel("Supercalifragilisticexpialidocious", 10);
    expect(lines.every((line) => line.length <= 10)).toBe(true);
    expect(lines.join("")).toBe("Supercalifragilisticexpialidocious");
  });

  it("should give one empty line for an empty label", () => {
    expect(wrapLabel("   ")).toEqual([""]);
  });
});

describe("barChartHeight", () => {
  it("should not fall under the minimum for one category (E1)", () => {
    expect(barChartHeight(1)).toBe(MIN_CHART_HEIGHT);
  });

  it("should grow with the number of categories (E2)", () => {
    expect(barChartHeight(20)).toBeGreaterThan(barChartHeight(10));
  });

  it("should grow when labels wrap onto more lines", () => {
    expect(barChartHeight(10, 3)).toBeGreaterThan(barChartHeight(10, 1));
  });

  it.each([0, -3, Number.NaN])("should give the minimum for %s categories", (count) => {
    expect(barChartHeight(count)).toBe(MIN_CHART_HEIGHT);
  });
});

describe("needsScroll", () => {
  it("should not scroll a short chart and should scroll one that is too tall", () => {
    expect(needsScroll(barChartHeight(5))).toBe(false);
    expect(needsScroll(barChartHeight(30))).toBe(true);
    expect(needsScroll(SCROLL_AFTER_HEIGHT)).toBe(false);
  });
});

describe("labelColumnWidth", () => {
  it("should not go under the floor for short labels", () => {
    expect(labelColumnWidth(["A", "B"])).toBe(80);
  });

  it("should not pass the ceiling for long labels", () => {
    expect(labelColumnWidth(["x".repeat(60)], 60)).toBe(160);
  });

  it("should follow the longest wrapped line", () => {
    expect(labelColumnWidth(["Quarantined seats"])).toBeGreaterThan(labelColumnWidth(["A"]));
  });

  it("should count the most lines a label wraps onto", () => {
    expect(maxLabelLines(["Open", "Awaiting technician assignment"], 18)).toBe(3);
  });
});

describe("describeBars", () => {
  it("should name every bar with its value", () => {
    expect(describeBars("Seats by status", [{ label: "Available", value: 12 }, { label: "Reserved", value: 1200 }])).toBe(
      "Seats by status: Available 12, Reserved 1,200",
    );
  });

  it("should write one bar (E1)", () => {
    expect(describeBars("Seats", [{ label: "Available", value: 4 }])).toBe("Seats: Available 4");
  });

  it("should say no data for a gap, not 0", () => {
    expect(describeBars("Seats", [{ label: "Available", value: null }])).toBe("Seats: Available no data");
  });

  it("should write a real zero as 0", () => {
    expect(describeBars("Seats", [{ label: "Retired", value: 0 }])).toBe("Seats: Retired 0");
  });
});

describe("stacks", () => {
  const series: ChartSeries[] = [
    { name: "Low", points: [{ label: "Open", value: 2 }, { label: "Closed", value: 5 }] },
    { name: "High", points: [{ label: "Open", value: 1 }] },
  ];

  it("should make one row per category with a key for each segment and the total", () => {
    expect(toStackRows(series)).toEqual([
      { label: "Open", s0: 2, s1: 1, total: 3 },
      { label: "Closed", s0: 5, s1: null, total: 5 },
    ]);
  });

  it("should not add a gap into the total", () => {
    expect(toStackRows([{ name: "A", points: [{ label: "X", value: null }] }])[0].total).toBe(0);
  });

  it("should describe every category with its segments and total", () => {
    expect(describeStacks("Incidents", series)).toBe("Incidents: Open: Low 2, High 1 (total 3); Closed: Low 5, High - (total 5)");
  });

  it("should draw one series with one category (E1)", () => {
    expect(toStackRows([{ name: "A", points: [{ label: "X", value: 7 }] }])).toEqual([{ label: "X", s0: 7, total: 7 }]);
  });
});
