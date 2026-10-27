import { describe, expect, it } from "vitest";

import { describeLines, labelsPoint, pointLabelStep, writesPointValues } from "@/lib/charts/line-data";

describe("pointLabelStep", () => {
  it.each([
    [1, 1],
    [8, 1],
    [9, 2],
    [12, 2],
    [16, 2],
    [17, 3],
    [24, 3],
  ])("should write a value at every %s points: step %s", (count, step) => {
    expect(pointLabelStep(count)).toBe(step);
  });

  it("should write every value when the count is not a number", () => {
    expect(pointLabelStep(Number.NaN)).toBe(1);
  });
});

describe("labelsPoint", () => {
  it("should label every point of a short line", () => {
    expect([0, 1, 2, 3].every((i) => labelsPoint(i, 4))).toBe(true);
  });

  it("should label every other point of twelve months, starting with the first", () => {
    const labelled = Array.from({ length: 12 }, (_, i) => labelsPoint(i, 12));
    expect(labelled).toEqual([true, false, true, false, true, false, true, false, true, false, true, false]);
  });
});

describe("describeLines", () => {
  it("should write every month with its full value", () => {
    expect(describeLines("Revenue", [{ name: "Net", points: [{ label: "Jan", value: 1_250_000 }, { label: "Feb", value: 90 }] }])).toBe(
      "Revenue: Net: Jan 1,250,000, Feb 90",
    );
  });

  it("should say no data for a gap, not 0", () => {
    expect(describeLines("Revenue", [{ name: "Net", points: [{ label: "Jan", value: null }] }])).toBe("Revenue: Net: Jan no data");
  });

  it("should write each series on its own", () => {
    const out = describeLines("Revenue", [
      { name: "Net", points: [{ label: "Jan", value: 1 }] },
      { name: "Gross", points: [{ label: "Jan", value: 2 }] },
    ]);
    expect(out).toBe("Revenue: Net: Jan 1; Gross: Jan 2");
  });

  it("should write one point (E1)", () => {
    expect(describeLines("R", [{ name: "Net", points: [{ label: "Jan", value: 5 }] }])).toBe("R: Net: Jan 5");
  });
});

describe("writesPointValues", () => {
  it("should write the values on a chart of one line", () => {
    expect(writesPointValues(1)).toBe(true);
  });

  it("should leave the values to the tooltip and the table when lines would write over each other", () => {
    expect(writesPointValues(2)).toBe(false);
    expect(writesPointValues(0)).toBe(false);
  });
});
