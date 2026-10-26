import { describe, expect, it } from "vitest";

import {
  buildMonthGrid,
  daysInMonth,
  formatIsoDate,
  isDateOutOfRange,
  parseIsoDate,
  shiftMonth,
} from "@/lib/forms/date";

describe("parseIsoDate", () => {
  it("should read a valid day", () => {
    expect(parseIsoDate("2026-11-18")).toEqual({ year: 2026, month: 11, day: 18 });
  });

  it("should return null for a day that does not exist", () => {
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("2026-13-01")).toBeNull();
  });

  it("should return null for text that is not an ISO date", () => {
    expect(parseIsoDate("18/11/2026")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
  });

  it("should accept 29 February only in a leap year", () => {
    expect(parseIsoDate("2028-02-29")).not.toBeNull();
    expect(parseIsoDate("2027-02-29")).toBeNull();
  });
});

describe("formatIsoDate", () => {
  it("should pad month and day", () => {
    expect(formatIsoDate({ year: 2026, month: 3, day: 4 })).toBe("2026-03-04");
  });
});

describe("daysInMonth", () => {
  it("should give 28, 29, 30 and 31 days where they belong", () => {
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe("isDateOutOfRange", () => {
  it("should accept a day inside the bounds, and the bounds themselves", () => {
    expect(isDateOutOfRange("2026-11-18", "2026-11-18", "2026-11-18")).toBe(false);
  });

  it("should reject a day before min or after max", () => {
    expect(isDateOutOfRange("2026-11-17", "2026-11-18")).toBe(true);
    expect(isDateOutOfRange("2026-11-19", undefined, "2026-11-18")).toBe(true);
  });

  it("should accept any day when there are no bounds", () => {
    expect(isDateOutOfRange("1999-01-01")).toBe(false);
  });
});

describe("shiftMonth", () => {
  it("should roll over the year in both directions", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("buildMonthGrid", () => {
  it("should always give six weeks, Monday first", () => {
    const grid = buildMonthGrid(2026, 11);
    expect(grid).toHaveLength(42);
    expect(grid[0].iso).toBe("2026-10-26");
  });

  it("should mark the days of other months as outside", () => {
    const grid = buildMonthGrid(2026, 11);
    expect(grid.filter((c) => c.inMonth)).toHaveLength(30);
    expect(grid[0].inMonth).toBe(false);
  });
});
