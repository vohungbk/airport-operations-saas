import type { BookingEventItem } from "@/features/bookings/lib/get-booking-events";

/** How many events are read; here so client code can use it without importing the server-only query. */
export const BOOKING_EVENTS_LIMIT = 100;

/** CO-F07-S05 (R14): where a booking came from, written in its "created" event. */
export type BookingSource = "manual" | "csv" | "webhook";

const BOOKING_SOURCES: readonly string[] = ["manual", "csv", "webhook"];

/** The source in the metadata of an event, or `null` when the event has none (an older booking). */
export function readBookingSource(metadata: Record<string, unknown> | null): BookingSource | null {
  const value = metadata?.source;

  return typeof value === "string" && BOOKING_SOURCES.includes(value) ? (value as BookingSource) : null;
}

/** CO-F07-S06 (E5): `true` when the "created" event says the booking waits for a seat to be allocated. */
export function readAllocationNeeded(metadata: Record<string, unknown> | null): boolean {
  return metadata?.allocation === "needed";
}

/**
 * The line of the "created" event: a booking made by hand keeps the plain text, an import or a webhook is named,
 * and a booking made with no seat in stock says it is flagged for allocation.
 */
export function describeBookingCreated(source?: BookingSource | null, allocationNeeded = false): string {
  const line =
    source === "csv"
      ? "Booking created by CSV import"
      : source === "webhook"
        ? "Booking created by webhook"
        : "Booking created";

  return allocationNeeded ? `${line}, no seat in stock, flagged for allocation` : line;
}

/** The filter chips of the Timeline tab, in the order of the design. */
export const TIMELINE_FILTERS = [
  { value: "all", label: "All" },
  { value: "status", label: "Status" },
  { value: "flight", label: "Flight" },
  { value: "money", label: "Money" },
  { value: "photos", label: "Photos" },
] as const;

export type TimelineFilter = (typeof TIMELINE_FILTERS)[number]["value"];

export type TimelineCategory = Exclude<TimelineFilter, "all">;

/**
 * One line of the Timeline tab. A booking event keeps its raw data (the tab draws it: status badges, seat
 * serials, changed fields); a flight update or an adjustment is already written as text on the server.
 * Everything here is plain data, so it can go from the server page to the client tab.
 */
export type TimelineEntry =
  | {
      kind: "event";
      id: string;
      category: TimelineCategory | null;
      occurred_at: string;
      event: BookingEventItem;
    }
  | {
      kind: "text";
      id: string;
      category: TimelineCategory;
      occurred_at: string;
      title: string;
      actor: string;
      lines: string[];
      reason: string | null;
    };

/**
 * A booking event is a Status event when it is the creation, a status change or a seat change. A field update
 * is only in All. Photo events are not recorded yet (CO-F06), so Photos stays empty until they are.
 */
export function getEventCategory(
  event: BookingEventItem,
): TimelineCategory | null {
  switch (event.event_type) {
    case "created":
    case "status_changed":
    case "seat_changed":
      return "status";
    default:
      return null;
  }
}

export function filterTimelineEntries(
  entries: readonly TimelineEntry[],
  filter: TimelineFilter,
): TimelineEntry[] {
  if (filter === "all") return [...entries];

  return entries.filter((entry) => entry.category === filter);
}

/** Time at the airport with its zone, for example `24 Oct 2026, 16:45 · Asia/Dubai`. */
export function formatTimelineTime(
  formatted: string,
  timeZone: string,
): string {
  return `${formatted} · ${timeZone}`;
}
