import { describe, expect, it } from "vitest";

import {
  FUTURE_MONTH_MESSAGE,
  INVALID_PERIOD_MESSAGE,
  currentMonthParam,
  kpiPeriodOptions,
  monthsInPeriod,
  previousKpiPeriod,
  resolveKpiPeriod,
} from "@/lib/kpi/kpi-period";

const NOW = new Date("2026-11-10T12:00:00.000Z");

describe("resolveKpiPeriod (VI-F05-S01, AC01, AC04)", () => {
  it("should default to the current month when no period is given", () => {
    for (const value of [undefined, "", "current"]) {
      expect(resolveKpiPeriod(value, NOW)).toEqual({
        ok: true,
        period: {
          param: "current",
          label: "November 2026",
          from: "2026-11-01T00:00:00.000Z",
          to: "2026-12-01T00:00:00.000Z",
        },
      });
    }
  });

  it("should give year to date from 1 January to the end of the current month", () => {
    expect(resolveKpiPeriod("ytd", NOW)).toEqual({
      ok: true,
      period: {
        param: "ytd",
        label: "Year to date 2026",
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-12-01T00:00:00.000Z",
      },
    });
  });

  it("should give the whole calendar month of a chosen month", () => {
    expect(resolveKpiPeriod("2026-10", NOW)).toEqual({
      ok: true,
      period: {
        param: "2026-10",
        label: "October 2026",
        from: "2026-10-01T00:00:00.000Z",
        to: "2026-11-01T00:00:00.000Z",
      },
    });
  });

  it("should accept the current month as a chosen month and roll December into the next year", () => {
    const december = new Date("2026-12-15T09:00:00.000Z");

    expect(resolveKpiPeriod("2026-12", december)).toMatchObject({
      ok: true,
      period: { from: "2026-12-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" },
    });
  });

  it("should refuse a month in the future with a clear message (V1)", () => {
    expect(resolveKpiPeriod("2026-12", NOW)).toEqual({ ok: false, message: FUTURE_MONTH_MESSAGE });
    expect(resolveKpiPeriod("2027-01", NOW)).toEqual({ ok: false, message: FUTURE_MONTH_MESSAGE });
  });

  it("should refuse a value that is not a period", () => {
    for (const value of ["abc", "2026-13", "2026-00", "2026-1", "1999-12", "ytd2", "2026-10-01"]) {
      expect(resolveKpiPeriod(value, NOW), value).toEqual({ ok: false, message: INVALID_PERIOD_MESSAGE });
    }
  });
});

describe("currentMonthParam", () => {
  it("should write the month of the date in UTC", () => {
    expect(currentMonthParam(NOW)).toBe("2026-11");
    expect(currentMonthParam(new Date("2026-01-31T23:59:00.000Z"))).toBe("2026-01");
  });
});

describe("kpiPeriodOptions (VI-F05-S01, F1)", () => {
  it("should offer the current month, year to date and the 11 months before, newest first", () => {
    const options = kpiPeriodOptions(NOW, "current");

    expect(options).toHaveLength(13);
    expect(options.slice(0, 4)).toEqual([
      { value: "current", label: "Current month" },
      { value: "ytd", label: "Year to date" },
      { value: "2026-10", label: "October 2026" },
      { value: "2026-09", label: "September 2026" },
    ]);
    expect(options[12]).toEqual({ value: "2025-12", label: "December 2025" });
  });

  it("should never offer a month in the future", () => {
    const months = kpiPeriodOptions(NOW, "current").map((option) => option.value).filter((value) => /^\d{4}-\d{2}$/.test(value));

    expect(months.every((month) => month <= currentMonthParam(NOW))).toBe(true);
  });

  it("should add a chosen month that is older than the list, so the dropdown shows the period of the page", () => {
    const options = kpiPeriodOptions(NOW, "2024-03");

    expect(options.at(-1)).toEqual({ value: "2024-03", label: "March 2024" });
  });

  it("should add nothing for a value that is not a period", () => {
    expect(kpiPeriodOptions(NOW, "abc")).toHaveLength(13);
    expect(kpiPeriodOptions(NOW, "2999-01")).toHaveLength(13);
  });
});

describe("previousKpiPeriod (VI-F05-S01, comparison)", () => {
  const period = (param: string) => {
    const result = resolveKpiPeriod(param, NOW);
    if (!result.ok) throw new Error("not a period");
    return result.period;
  };

  it("should be the month before a month, and the month before the current month", () => {
    expect(previousKpiPeriod(period("2026-10"))).toEqual({
      label: "September 2026",
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-01T00:00:00.000Z",
    });
    expect(previousKpiPeriod(period("current"))).toEqual({
      label: "October 2026",
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-11-01T00:00:00.000Z",
    });
  });

  it("should cross into the year before for January", () => {
    expect(previousKpiPeriod(period("2026-01"))).toEqual({
      label: "December 2025",
      from: "2025-12-01T00:00:00.000Z",
      to: "2026-01-01T00:00:00.000Z",
    });
  });

  it("should be the same stretch of the year before for year to date", () => {
    expect(previousKpiPeriod(period("ytd"))).toEqual({
      label: "Year to date 2025",
      from: "2025-01-01T00:00:00.000Z",
      to: "2025-12-01T00:00:00.000Z",
    });
  });
});

describe("monthsInPeriod (VI-F05-S06)", () => {
  it("should count the months so far this year, the current month included, for year to date", () => {
    expect(monthsInPeriod("ytd", NOW)).toBe(11);
    expect(monthsInPeriod("ytd", new Date("2026-01-31T12:00:00.000Z"))).toBe(1);
  });

  it.each(["current", "2026-09"])("should count one month for %s", (param) => {
    expect(monthsInPeriod(param, NOW)).toBe(1);
  });
});
