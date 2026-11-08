import { z } from "zod";

/**
 * The period of the KPI dashboard (VI-F05-S01, F1, V1): the current month, year to date, or a chosen
 * month. A month is a calendar month in UTC and a period is `[from, to)`. The same function runs in the
 * browser (the picker) and on the server (the page), so a month in the future is refused in both places
 * with the same message. Pure, no I/O.
 */

export const INVALID_PERIOD_MESSAGE = "Choose the current month, year to date, or a month";
export const FUTURE_MONTH_MESSAGE = "Choose a month that is not in the future";

const FIRST_YEAR = 2000;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const kpiPeriodParamSchema = z.union([
  z.literal("current"),
  z.literal("ytd"),
  z.string().regex(MONTH),
]);

export interface ResolvedKpiPeriod {
  /** `current`, `ytd` or `YYYY-MM`: what the address and the picker carry. */
  param: string;
  label: string;
  /** Inside the period. */
  from: string;
  /** Not inside the period. */
  to: string;
}

export type KpiPeriodResult =
  | { ok: true; period: ResolvedKpiPeriod }
  | { ok: false; message: string };

/** `2026-11`: the month of `now`, the latest month a user may choose. */
export function currentMonthParam(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The months a period covers (VI-F05-S06): year to date is the months so far this year, the current month
 * included; the current month and a chosen month are one.
 */
export function monthsInPeriod(param: string, now: Date): number {
  return param === "ytd" ? now.getUTCMonth() + 1 : 1;
}

const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);

/** An empty or missing value is the current month. */
export function resolveKpiPeriod(param: string | undefined, now: Date): KpiPeriodResult {
  const parsed = kpiPeriodParamSchema.safeParse(param === undefined || param === "" ? "current" : param);

  if (!parsed.success) return { ok: false, message: INVALID_PERIOD_MESSAGE };

  const value = parsed.data;
  const thisMonth = currentMonthParam(now);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const next = new Date(Date.UTC(year, month + 1, 1)).toISOString();

  if (value === "current") {
    return {
      ok: true,
      period: { param: "current", label: monthLabel(now), from: new Date(Date.UTC(year, month, 1)).toISOString(), to: next },
    };
  }

  if (value === "ytd") {
    return {
      ok: true,
      period: { param: "ytd", label: `Year to date ${year}`, from: new Date(Date.UTC(year, 0, 1)).toISOString(), to: next },
    };
  }

  const [chosenYear, chosenMonth] = [Number(value.slice(0, 4)), Number(value.slice(5, 7))];

  if (chosenYear < FIRST_YEAR) return { ok: false, message: INVALID_PERIOD_MESSAGE };
  if (value > thisMonth) return { ok: false, message: FUTURE_MONTH_MESSAGE };

  const from = new Date(Date.UTC(chosenYear, chosenMonth - 1, 1));

  return {
    ok: true,
    period: {
      param: value,
      label: monthLabel(from),
      from: from.toISOString(),
      to: new Date(Date.UTC(chosenYear, chosenMonth, 1)).toISOString(),
    },
  };
}

export interface KpiPeriodOption {
  value: string;
  label: string;
}

const RECENT_MONTHS = 11;

/**
 * What the period dropdown offers (VI-F05-S01, F1): the current month, year to date, and the months before
 * the current one, newest first. A month the address carries that is older than the list is added, so the
 * dropdown always shows the period the page is on. A month in the future is never offered.
 */
export function kpiPeriodOptions(now: Date, selected: string): KpiPeriodOption[] {
  const options: KpiPeriodOption[] = [
    { value: "current", label: "Current month" },
    { value: "ytd", label: "Year to date" },
  ];

  for (let back = 1; back <= RECENT_MONTHS; back += 1) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    options.push({ value: currentMonthParam(month), label: monthLabel(month) });
  }

  if (!options.some((option) => option.value === selected)) {
    const result = resolveKpiPeriod(selected, now);

    if (result.ok && MONTH.test(selected)) options.push({ value: selected, label: result.period.label });
  }

  return options;
}

export interface PreviousKpiPeriod {
  label: string;
  from: string;
  to: string;
}

/**
 * The period the figures are compared with (VI-F05-S01, design "Compare September"): for a month, the month
 * before it; for year to date, the same stretch of the year before. The same calendar rules as the period
 * itself, so the two always have the same length of rule. Pure, no I/O.
 */
export function previousKpiPeriod(period: ResolvedKpiPeriod): PreviousKpiPeriod {
  const from = new Date(period.from);
  const to = new Date(period.to);

  if (period.param === "ytd") {
    const year = from.getUTCFullYear() - 1;

    return {
      label: `Year to date ${year}`,
      from: new Date(Date.UTC(year, 0, 1)).toISOString(),
      to: new Date(Date.UTC(to.getUTCFullYear() - 1, to.getUTCMonth(), 1)).toISOString(),
    };
  }

  const previous = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1));

  return { label: monthLabel(previous), from: previous.toISOString(), to: period.from };
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** How many months the trend of the ROI dashboard shows (VI-F05-S07). */
export const TREND_MONTH_COUNT = 6;

export interface TrendMonth {
  /** `May`: the three-letter name the trend line is worded with. */
  label: string;
  /** Inside the month. */
  from: string;
  /** Not inside the month. */
  to: string;
}

/**
 * The calendar months of the trend (VI-F05-S07, AC02): the last `count` months, oldest first, ending with the last
 * month of the period. A month and the current month end with themselves; year to date ends with the current month.
 * Same UTC months as `resolveKpiPeriod`, so the trend and the total of the period never read different calendars.
 * Pure, no I/O.
 */
export function trendMonths(period: ResolvedKpiPeriod, count: number = TREND_MONTH_COUNT): TrendMonth[] {
  const end = new Date(period.to);

  return Array.from({ length: count }, (_, index) => {
    const back = count - index;
    const from = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - back, 1));
    const to = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - back + 1, 1));

    return { label: MONTH_NAMES[from.getUTCMonth()], from: from.toISOString(), to: to.toISOString() };
  });
}
