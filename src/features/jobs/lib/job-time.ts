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
