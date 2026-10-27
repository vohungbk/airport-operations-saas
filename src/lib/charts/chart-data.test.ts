import { describe, expect, it } from "vitest";

import {
  abbreviateNumber,
  chartFrameState,
  classifyChartData,
  formatFullNumber,
  toChartTable,
  type ChartSeries,
} from "@/lib/charts/chart-data";

const series = (...values: (number | null)[]): ChartSeries[] => [
  { name: "Seats", points: values.map((value, i) => ({ label: `L${i + 1}`, value })) },
];

describe("classifyChartData", () => {
  it("should be ready when every point has a value", () => {
    expect(classifyChartData(series(3, 5, 8))).toBe("ready");
  });

  it("should be ready for one value (E1)", () => {
    expect(classifyChartData(series(4))).toBe("ready");
  });

  it("should be ready for one series with one point of zero among others", () => {
    expect(classifyChartData(series(0, 7))).toBe("ready");
  });

  it("should be empty when there is no series or no point", () => {
    expect(classifyChartData([])).toBe("empty");
    expect(classifyChartData([{ name: "Seats", points: [] }])).toBe("empty");
  });

  it("should be empty when every value is 0, so zeros are never shown as live data", () => {
    expect(classifyChartData(series(0, 0, 0))).toBe("empty");
  });

  it("should be empty when every value is a gap", () => {
    expect(classifyChartData(series(null, null))).toBe("empty");
  });

  it("should be partial when some points are gaps", () => {
    expect(classifyChartData(series(3, null, 8))).toBe("partial");
  });

  it("should treat a value that is not a number as a gap", () => {
    expect(classifyChartData(series(3, Number.NaN))).toBe("partial");
  });
});

describe("chartFrameState", () => {
  it("should follow the data when the chart was read", () => {
    expect(chartFrameState("ready", series(3, 5))).toBe("ready");
    expect(chartFrameState("ready", series(3, null))).toBe("partial");
    expect(chartFrameState("ready", series(0, 0))).toBe("empty");
  });

  it.each(["loading", "error", "forbidden"] as const)("should show %s whatever data it was given", (status) => {
    expect(chartFrameState(status, series(3, 5))).toBe(status);
  });
});

describe("abbreviateNumber", () => {
  it.each([
    [0, "0"],
    [12, "12"],
    [999, "999"],
    [1000, "1K"],
    [1250, "1.3K"],
    [1_200_000, "1.2M"],
    [3_400_000_000, "3.4B"],
    [999_999, "1M"],
    [-2500, "-2.5K"],
  ])("should write %s as %s", (value, text) => {
    expect(abbreviateNumber(value)).toBe(text);
  });

  it("should write a value that is not a number as a dash", () => {
    expect(abbreviateNumber(Number.NaN)).toBe("-");
    expect(abbreviateNumber(Infinity)).toBe("-");
  });
});

describe("formatFullNumber", () => {
  it("should keep the whole number with separators", () => {
    expect(formatFullNumber(1_200_000)).toBe("1,200,000");
  });

  it("should write 0 as 0 and a gap as a dash", () => {
    expect(formatFullNumber(0)).toBe("0");
    expect(formatFullNumber(null)).toBe("-");
  });
});

describe("toChartTable", () => {
  it("should give the same numbers as the chart, in full", () => {
    const table = toChartTable(series(1_200_000, 5));
    expect(table.columns).toEqual(["Name", "Seats"]);
    expect(table.rows).toEqual([
      ["L1", "1,200,000"],
      ["L2", "5"],
    ]);
  });

  it("should show a gap as a dash, not 0", () => {
    expect(toChartTable(series(3, null)).rows[1]).toEqual(["L2", "-"]);
  });

  it("should line up two series by label, with a dash where one has no point", () => {
    const table = toChartTable([
      { name: "Open", points: [{ label: "Mon", value: 2 }] },
      { name: "Closed", points: [{ label: "Mon", value: 1 }, { label: "Tue", value: 4 }] },
    ]);
    expect(table.columns).toEqual(["Name", "Open", "Closed"]);
    expect(table.rows).toEqual([
      ["Mon", "2", "1"],
      ["Tue", "-", "4"],
    ]);
  });

  it("should use the heading it is given for the first column", () => {
    expect(toChartTable(series(1), "Month").columns[0]).toBe("Month");
  });
});
