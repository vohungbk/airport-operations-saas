/**
 * Pure date logic for the calendar and the date picker (UI-F03-S02). A date is an ISO string
 * `YYYY-MM-DD` with no time zone, so a picked day never shifts with the device clock.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Returns null for anything that is not a real calendar day, such as `2026-02-30`. */
export function parseIsoDate(value: string): DateParts | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function formatIsoDate({ year, month, day }: DateParts): string {
  const pad = (n: number, size: number) => String(n).padStart(size, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** `true` when the day is outside the optional `min` / `max` bounds (ISO strings compare as text). */
export function isDateOutOfRange(iso: string, min?: string, max?: string): boolean {
  return (min !== undefined && iso < min) || (max !== undefined && iso > max);
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export interface CalendarCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

/** Six weeks of cells (42), Monday first, so the grid keeps its height from month to month. */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const start = Date.UTC(year, month - 1, 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start + i * 86_400_000);
    const parts = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    return { iso: formatIsoDate(parts), day: parts.day, inMonth: parts.month === month };
  });
}
