import { describe, expect, it } from "vitest";

import { centerTotal, describeSlices, donutTable, sliceDetail, toDonutSeries, toSlices, wholeShares } from "@/lib/charts/donut-data";

describe("wholeShares", () => {
  it("should add up to 100 when the exact shares do not", () => {
    const shares = wholeShares([1, 1, 1]);
    expect(shares).toEqual([34, 33, 33]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("should give the missing point to the largest remainder", () => {
    expect(wholeShares([120, 73])).toEqual([62, 38]);
  });

  it("should give 100 to a single value (E1)", () => {
    expect(wholeShares([5])).toEqual([100]);
  });

  it("should give 0 to every value when the total is 0, and nothing for no values", () => {
    expect(wholeShares([0, 0])).toEqual([0, 0]);
    expect(wholeShares([])).toEqual([]);
  });

  it("should give 0 to a value of 0 among others", () => {
    expect(wholeShares([0, 10])).toEqual([0, 100]);
  });
});

describe("toSlices", () => {
  it("should give the slices in order, with the total", () => {
    const { slices, total } = toSlices([{ label: "Available", value: 120 }, { label: "Reserved", value: 73 }]);
    expect(slices).toEqual([
      { label: "Available", value: 120, share: 62 },
      { label: "Reserved", value: 73, share: 38 },
    ]);
    expect(total).toBe(193);
  });

  it("should keep a slice of 0 with a share of 0", () => {
    expect(toSlices([{ label: "Retired", value: 0 }, { label: "Available", value: 4 }]).slices[0]).toEqual({ label: "Retired", value: 0, share: 0 });
  });

  it("should leave out a gap, a negative value and a value that is not a number, and not count them in the total", () => {
    const { slices, total } = toSlices([
      { label: "A", value: 10 },
      { label: "B", value: null },
      { label: "C", value: -3 },
      { label: "D", value: Number.NaN },
    ]);
    expect(slices.map((s) => s.label)).toEqual(["A"]);
    expect(total).toBe(10);
  });

  it("should give an empty donut for no items", () => {
    expect(toSlices([])).toEqual({ slices: [], total: 0 });
  });
});

describe("toDonutSeries", () => {
  it("should turn a value that cannot be a share into a gap, so the frame can note it", () => {
    const [series] = toDonutSeries([{ label: "A", value: 5 }, { label: "B", value: -1 }], "Seats");
    expect(series.points.map((p) => p.value)).toEqual([5, null]);
  });
});

describe("describing the donut", () => {
  const data = toSlices([{ label: "Available", value: 120 }, { label: "Reserved", value: 73 }]);

  it("should write each slice with its full value and share, and the total", () => {
    expect(describeSlices("Seats by status", data)).toBe("Seats by status: Available 120 (62%), Reserved 73 (38%); total 193");
  });

  it("should write the detail of a slice for the legend", () => {
    expect(sliceDetail(data.slices[0])).toBe("120 · 62%");
  });

  it("should write the full number to the screen reader when the middle shows 1.3M", () => {
    const big = toSlices([{ label: "Revenue", value: 1_250_000 }]);
    expect(centerTotal(big.total)).toBe("1.3M");
    expect(describeSlices("Revenue", big)).toContain("1,250,000");
  });
});

describe("donutTable", () => {
  it("should give name, full count and share, and a row for the total (E3)", () => {
    const table = donutTable([{ label: "Available", value: 1_200_000 }, { label: "Reserved", value: 800_000 }], "Seats");
    expect(table.columns).toEqual(["Name", "Seats", "Share"]);
    expect(table.rows).toEqual([
      ["Available", "1,200,000", "60%"],
      ["Reserved", "800,000", "40%"],
      ["Total", "2,000,000", "100%"],
    ]);
  });

  it("should show a gap as a dash, not 0", () => {
    const table = donutTable([{ label: "A", value: 120 }, { label: "B", value: null }, { label: "C", value: 73 }], "Seats");
    expect(table.rows[1]).toEqual(["B", "-", "-"]);
  });

  it("should list a slice of 0 as 0 and 0%", () => {
    expect(donutTable([{ label: "Retired", value: 0 }, { label: "A", value: 1 }], "Seats").rows[0]).toEqual(["Retired", "0", "0%"]);
  });

  it("should have no total row when there is nothing to share", () => {
    expect(donutTable([{ label: "A", value: null }], "Seats").rows).toEqual([["A", "-", "-"]]);
  });
});
