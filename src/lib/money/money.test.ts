import { describe, expect, it } from "vitest";

import { formatAmount, meterProgress, sumVerified, toCents } from "@/lib/money/money";

describe("formatAmount", () => {
  it.each([
    [12.5, "12.50", false],
    [0, "0.00", false],
    [1234567.891, "1234567.89", false],
    [-12.5, "-12.50", true],
    [-0.05, "-0.05", true],
  ])("should write %s as %s", (value, text, negative) => {
    expect(formatAmount(value)).toEqual({ text, negative });
  });

  it("should write minus zero and an amount that rounds to zero without a sign", () => {
    expect(formatAmount(-0)).toEqual({ text: "0.00", negative: false });
    expect(formatAmount(-0.004)).toEqual({ text: "0.00", negative: false });
  });

  it("should not write NaN or infinity as an amount", () => {
    expect(formatAmount(Number.NaN).text).toBe("0.00");
    expect(formatAmount(Number.POSITIVE_INFINITY).text).toBe("0.00");
  });
});

describe("sumVerified", () => {
  it("should add in cents so that 0.1 and 0.2 make 0.30", () => {
    expect(sumVerified([{ label: "a", amount: 0.1 }, { label: "b", amount: 0.2 }])).toBe(0.3);
  });

  it("should subtract a refund and a chargeback", () => {
    expect(
      sumVerified([
        { label: "Gross", amount: 100 },
        { label: "Refund", amount: -20, kind: "refund" },
        { label: "Chargeback", amount: -5.5, kind: "chargeback" },
      ]),
    ).toBe(74.5);
  });

  it("should be zero for no lines", () => {
    expect(sumVerified([])).toBe(0);
  });

  it("should not take an estimate: it has no amount to add", () => {
    // @ts-expect-error an estimated line is not a verified line
    expect(sumVerified([{ label: "x", estimate: 50 }])).toBeNaN();
  });
});

describe("toCents", () => {
  it("should round, not cut", () => {
    expect(toCents(10.126)).toBe(1013);
    expect(toCents(10.124)).toBe(1012);
    expect(toCents(19.99)).toBe(1999);
  });
});

describe("meterProgress", () => {
  it("should give the share of the target", () => {
    expect(meterProgress(25, 100)).toEqual({ percent: 25, share: 25 });
  });

  it("should stop the bar at 100 and keep the true share when the target is passed", () => {
    expect(meterProgress(120, 100)).toEqual({ percent: 100, share: 120 });
  });

  it("should not go below 0", () => {
    expect(meterProgress(-10, 100).percent).toBe(0);
  });

  it.each([null, 0, -5])("should have no progress when the target is %s", (target) => {
    expect(meterProgress(10, target)).toEqual({ percent: null, share: null });
  });
});
