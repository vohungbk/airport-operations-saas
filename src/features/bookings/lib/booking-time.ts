/**
 * Booking times are typed as wall-clock time at the airport, stored as
 * UTC, and shown back in the airport's timezone. Uses `Intl` only (no
 * date library). All functions are pure.
 */

const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }

  return formatter;
}

function getZonedParts(utcMs: number, timeZone: string) {
  const parts: Record<string, number> = {};

  for (const part of getFormatter(timeZone).formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }

  return parts;
}

/** Offset (zone minus UTC) in ms at the given instant. */
function getOffsetMs(utcMs: number, timeZone: string): number {
  const p = getZonedParts(utcMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);

  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** True for a calendar-valid `YYYY-MM-DDTHH:mm` string. */
export function isLocalDateTime(value: string): boolean {
  const match = LOCAL_DATETIME_PATTERN.exec(value);

  if (!match) return false;

  const [, y, mo, d, h, mi] = match.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi));

  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d &&
    h < 24 &&
    mi < 60
  );
}

/**
 * Converts `YYYY-MM-DDTHH:mm` wall-clock time in `timeZone` to a UTC ISO
 * string. Returns `null` for a malformed value or an unknown timezone.
 * A time skipped by a DST jump resolves to the instant just after it.
 */
export function zonedLocalToUtcIso(
  local: string,
  timeZone: string,
): string | null {
  if (!isLocalDateTime(local)) return null;

  const [, y, mo, d, h, mi] = LOCAL_DATETIME_PATTERN.exec(local)!.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);

  try {
    const firstOffset = getOffsetMs(guess, timeZone);
    let utc = guess - firstOffset;
    const secondOffset = getOffsetMs(utc, timeZone);

    if (secondOffset !== firstOffset) {
      utc = guess - secondOffset;
    }

    return new Date(utc).toISOString();
  } catch {
    return null;
  }
}

/** UTC ISO instant -> `YYYY-MM-DDTHH:mm` wall-clock time in `timeZone`. */
export function utcToZonedLocalInput(iso: string, timeZone: string): string {
  const p = getZonedParts(new Date(iso).getTime(), timeZone);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");

  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Human-readable date and time in the airport's timezone. */
export function formatBookingDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/**
 * Start of the given `YYYY-MM-DD` day in `timeZone` as a UTC ISO string;
 * `addDays` shifts the day first (1 = start of the next day, used as an
 * exclusive upper bound). Returns `null` for a malformed date.
 */
export function zonedDayStartToUtcIso(
  date: string,
  timeZone: string,
  addDays = 0,
): string | null {
  const match = LOCAL_DATE_PATTERN.exec(date);

  if (!match) return null;

  const [, y, mo, d] = match.map(Number);
  const shifted = new Date(Date.UTC(y, mo - 1, d + addDays));
  const local = `${shifted.toISOString().slice(0, 10)}T00:00`;

  return zonedLocalToUtcIso(local, timeZone);
}
