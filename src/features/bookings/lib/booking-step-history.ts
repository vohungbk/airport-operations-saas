import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { BookingEventItem } from "@/features/bookings/lib/get-booking-events";

/**
 * The step history of a booking (CO-F08-S06): the events that tell where the booking was, from the
 * append-only `booking_events` log, newest first. Only the creation and the changes of step belong
 * here; edits and seat changes stay in the timeline of the booking. Pure, no I/O.
 */

export const BOOKING_CREATED_TITLE = "Booking created";

/** Shown when the actor is unknown or hidden by RLS (a partner user cannot read staff names). */
export const UNKNOWN_ACTOR_LABEL = "Staff";

export interface StepHistoryRow {
  id: string;
  /** The step the booking moved to, or "Booking created". */
  title: string;
  actor_name: string | null;
  created_at: string;
  notes: string | null;
}

/** Keeps the order of `events` (newest first). */
export function buildStepHistory(events: readonly BookingEventItem[]): StepHistoryRow[] {
  const rows: StepHistoryRow[] = [];

  for (const event of events) {
    if (event.event_type !== "created" && event.event_type !== "status_changed") continue;

    rows.push({
      id: event.id,
      title: event.event_type === "created" ? BOOKING_CREATED_TITLE : BOOKING_STATUS_LABEL[event.to_status],
      actor_name: event.actor_name,
      created_at: event.created_at,
      notes: event.notes,
    });
  }

  return rows;
}

/** Whole minutes the booking has been in its current step; `null` when no event says when it started. */
export function minutesInStep(history: readonly StepHistoryRow[], now: Date): number | null {
  const latest = history[0];
  if (!latest) return null;

  const minutes = Math.floor((now.getTime() - new Date(latest.created_at).getTime()) / 60_000);
  return Math.max(0, minutes);
}

/** "45 min", "2 h", "2 h 10 min". */
export function formatTimeInStep(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** A day in the airport's timezone: "24 Oct 2026". */
export function formatStepDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
