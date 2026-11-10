import type { BookingEventItem } from "@/features/bookings/lib/get-booking-events";

/** How many events are read; here so client code can use it without importing the server-only query. */
export const BOOKING_EVENTS_LIMIT = 100;

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
