/**
 * How Today's Jobs writes a time (UI-F07-S01): in the time zone of the airport, with the short zone name of
 * the design (`GST` for Asia/Dubai).
 */

const ZONE_NAMES: Record<string, string> = { "Asia/Dubai": "GST" };

/** `GST` for Asia/Dubai, the short name `Intl` gives for any other zone. */
export function zoneLabel(timeZone: string): string {
  return (
    ZONE_NAMES[timeZone] ??
    new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value ??
    timeZone
  );
}

/** `16:30` */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

/** `24 Oct` */
export function formatDayMonth(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(new Date(iso));
}

/** `24 Oct 2026` */
export function formatDate(iso: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(iso));
}

/** `28 Oct, 14:30 UTC`: the time of the next job in the empty state. */
export function formatNextJob(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** How far `timeZone` is ahead of UTC at this instant, in ms. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));

  return wall - Math.floor(utcMs / 1000) * 1000;
}

/** The instant a calendar day (`YYYY-MM-DD`) starts in `timeZone`, as an ISO string. */
export function zonedDayStart(date: string, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const midnightAsUtc = Date.UTC(year, month - 1, day);
  const first = midnightAsUtc - zoneOffsetMs(midnightAsUtc, timeZone);

  return new Date(midnightAsUtc - zoneOffsetMs(first, timeZone)).toISOString();
}

/** The day after a `YYYY-MM-DD` date. */
export function nextDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayParts(date: string) {
  const [year, month, day] = date.split("-");

  return { year, month: MONTHS[Number(month) - 1], day };
}

/**
 * The date range as the filter writes it: `01-04 Nov 2026 GST` inside one month, `28 Oct 2026 - 04 Nov 2026 GST`
 * across months, `From 01 Nov 2026 GST` or `Until 04 Nov 2026 GST` with one end, and `` with none. Pure.
 */
export function formatDateRangeLabel(from: string | undefined, to: string | undefined, timeZone: string): string {
  const zone = zoneLabel(timeZone);

  if (from && to) {
    const a = dayParts(from);
    const b = dayParts(to);

    return a.year === b.year && a.month === b.month
      ? `${a.day}-${b.day} ${b.month} ${b.year} ${zone}`
      : `${a.day} ${a.month} ${a.year} - ${b.day} ${b.month} ${b.year} ${zone}`;
  }
  if (from) return `From ${dayParts(from).day} ${dayParts(from).month} ${dayParts(from).year} ${zone}`;
  if (to) return `Until ${dayParts(to).day} ${dayParts(to).month} ${dayParts(to).year} ${zone}`;

  return "";
}
