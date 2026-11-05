import type { FlightChange } from "@/features/flights/lib/flight-diff";
import { formatClock } from "@/features/flights/lib/flight-panel";
import type { FlightUpdateItem, FlightUpdateSource } from "@/features/flights/schemas/flight-update.schema";
import { formatDate, formatTime } from "@/features/jobs/lib/job-time";
import { getStatusLook } from "@/lib/status/domain-status";

/**
 * Pure rules of the flight update history card (VI-F02-T01): how an entry is written, in the time
 * zone of the airport. No I/O.
 */

export const SOURCE_LABEL: Record<FlightUpdateSource, string> = {
  provider: "Provider",
  system: "System",
  manual: "Manual",
};

/** The fixed end of the second line of an entry (the design: the record is kept, never deleted). */
export const RETENTION_NOTE = "Audit record retained";

const isDate = (value: string) => Number.isFinite(Date.parse(value));

/** `15:45 GST`; a value that is not a date is shown as it was stored, never as an error. */
function clock(value: string | number, timeZone: string): string {
  const text = String(value);
  return isDate(text) ? formatClock(text, timeZone) : text;
}

/** What one change says: `Estimated arrival updated to 15:45 GST`. */
export function describeChange(change: FlightChange, timeZone: string): string {
  const { field, to } = change;

  switch (field) {
    case "status":
      return to === null ? "Status cleared" : `Status changed to ${getStatusLook("flight", String(to)).label}`;
    case "estimated_arrival_at":
      return to === null ? "Estimated arrival cleared" : `Estimated arrival updated to ${clock(to, timeZone)}`;
    case "actual_arrival_at":
      return to === null ? "Actual arrival cleared" : `Actual arrival updated to ${clock(to, timeZone)}`;
    case "terminal":
      return to === null ? "Terminal cleared" : `Terminal changed to ${to}`;
    case "delay_minutes":
      return to === null ? "Delay cleared" : `Delay updated to ${to} min`;
  }
}

/** `14:02 · Provider — Estimated arrival updated to 15:45 GST` */
export function formatUpdateHeadline(update: FlightUpdateItem, timeZone: string): string {
  const what = update.changes.map((change) => describeChange(change, timeZone)).join("; ");

  return `${formatTime(update.occurred_at, timeZone)} · ${SOURCE_LABEL[update.source]} — ${what}`;
}

/** `24 Oct 2026 · Asia/Dubai · Audit record retained` */
export function formatUpdateDetail(update: FlightUpdateItem, timeZone: string): string {
  return `${formatDate(update.occurred_at, timeZone)} · ${timeZone} · ${RETENTION_NOTE}`;
}
