import { describe, expect, it } from "vitest";

import { barPercent, formatChange, hasAnswerData } from "@/lib/assistant/answer";

describe("formatChange", () => {
  it("should write a rise with a plus sign", () => {
    expect(formatChange(112.5, 100)).toEqual({ direction: "up", text: "+12.5%" });
  });

  it("should write a fall with a minus sign", () => {
    expect(formatChange(92, 100)).toEqual({ direction: "down", text: "-8.0%" });
  });

  it("should say flat when nothing changed", () => {
    expect(formatChange(100, 100)).toEqual({ direction: "flat", text: "0%" });
  });

  it("should say n/a when the period before was zero, not Infinity", () => {
    expect(formatChange(10, 0)).toEqual({ direction: "unknown", text: "n/a" });
  });

  it("should say n/a when there is no period before", () => {
    expect(formatChange(10, null)).toEqual({ direction: "unknown", text: "n/a" });
  });

  it("should say n/a for a figure that is not a number", () => {
    expect(formatChange(Number.NaN, 5).text).toBe("n/a");
  });

  it("should measure a change from a negative base against its size", () => {
    expect(formatChange(-50, -100)).toEqual({ direction: "up", text: "+50.0%" });
  });
});

describe("barPercent", () => {
  it("should give the share of the biggest bar", () => {
    expect(barPercent(25, 100)).toBe(25);
  });

  it.each([
    [0, 100],
    [-5, 100],
    [5, 0],
    [Number.NaN, 100],
  ])("should give an empty bar for value %s and maximum %s", (value, max) => {
    expect(barPercent(value, max)).toBe(0);
  });

  it("should not pass 100", () => {
    expect(barPercent(300, 100)).toBe(100);
  });
});

describe("hasAnswerData", () => {
  it("should be false for no blocks", () => {
    expect(hasAnswerData([])).toBe(false);
  });

  it("should be false when every block is empty", () => {
    expect(
      hasAnswerData([
        { type: "text", text: "   " },
        { type: "table", columns: ["A"], rows: [] },
        { type: "chart", title: "T", bars: [] },
        { type: "kpi", items: [] },
        { type: "recommendations", items: [] },
      ]),
    ).toBe(false);
  });

  it("should be true when one block has content", () => {
    expect(hasAnswerData([{ type: "text", text: "" }, { type: "recommendations", items: ["Add seats"] }])).toBe(true);
  });
});
