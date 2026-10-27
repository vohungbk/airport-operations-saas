import { describe, expect, it } from "vitest";

import { changeWords, describeKpi, describeSparkline, kpiComparison, kpiTileState, lastKnownIndex, sparklineReady } from "@/lib/charts/kpi-data";

const points = (...values: (number | null)[]) => values.map((value, i) => ({ label: `M${i + 1}`, value }));

describe("kpiTileState", () => {
  it("should be ready when the figure was read", () => {
    expect(kpiTileState("ready", 120)).toBe("ready");
  });

  it("should show a real 0 as a figure, not as missing", () => {
    expect(kpiTileState("ready", 0)).toBe("ready");
  });

  it("should be empty when the figure could not be read, not 0", () => {
    expect(kpiTileState("ready", null)).toBe("empty");
    expect(kpiTileState("ready", Number.NaN)).toBe("empty");
  });

  it.each(["loading", "error", "forbidden"] as const)("should show %s whatever figure it was given", (status) => {
    expect(kpiTileState(status, 120)).toBe(status);
  });
});

describe("kpiComparison", () => {
  it("should keep the full number beside the shortened one", () => {
    const k = kpiComparison(1_250_000, 1_000_000);
    expect(k.current_short).toBe("1.3M");
    expect(k.current_full).toBe("1,250,000");
    expect(k.previous_full).toBe("1,000,000");
  });

  it("should have no previous figure when there is none", () => {
    expect(kpiComparison(5, null).previous_full).toBeNull();
  });
});

describe("changeWords", () => {
  it.each([
    [120, 100, "Up 20.0%"],
    [92, 100, "Down 8.0%"],
    [100, 100, "No change"],
  ])("should word %s against %s as %s", (current, previous, words) => {
    expect(changeWords(kpiComparison(current, previous).change)).toBe(words);
  });

  it("should say there is no comparison when the period before was 0 or is missing, not Infinity", () => {
    expect(changeWords(kpiComparison(8, 0).change)).toBe("No comparison");
    expect(changeWords(kpiComparison(8, null).change)).toBe("No comparison");
  });
});

describe("describeKpi", () => {
  it("should write both periods and the change as one sentence", () => {
    expect(describeKpi("Revenue", 1250, 1000)).toBe("Revenue: This month 1,250; Last month 1,000; Up 25.0%");
  });

  it("should use the period names it is given", () => {
    expect(describeKpi("Bookings", 3, 4, { current: "May", previous: "April" })).toBe("Bookings: May 3; April 4; Down 25.0%");
  });

  it("should say no data for a missing previous period", () => {
    expect(describeKpi("Revenue", 5, null)).toBe("Revenue: This month 5; Last month no data; No comparison");
  });
});

describe("sparkline", () => {
  it("should be ready with two or more values", () => {
    expect(sparklineReady(points(1, 2))).toBe(true);
  });

  it("should not be drawn for one value or none, since one value is not a trend", () => {
    expect(sparklineReady(points(5))).toBe(false);
    expect(sparklineReady([])).toBe(false);
  });

  it("should not be drawn when every value is 0", () => {
    expect(sparklineReady(points(0, 0, 0))).toBe(false);
  });

  it("should not be drawn when only one value is known", () => {
    expect(sparklineReady(points(null, 4, null))).toBe(false);
  });

  it("should be drawn with a gap between known values", () => {
    expect(sparklineReady(points(3, null, 5))).toBe(true);
  });

  it("should find the last point that has a value", () => {
    expect(lastKnownIndex(points(1, 2, null))).toBe(1);
    expect(lastKnownIndex(points(null, null))).toBe(-1);
  });

  it("should write every point with its full value for the label", () => {
    expect(describeSparkline("Revenue", [{ label: "Jan", value: 1_250_000 }, { label: "Feb", value: null }])).toBe(
      "Revenue trend: Jan 1,250,000, Feb no data",
    );
  });
});
