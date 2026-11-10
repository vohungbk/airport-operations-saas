import { formatUsd } from "@/features/bookings/lib/booking-revenue";
import {
  getEventCategory,
  type TimelineEntry,
} from "@/features/bookings/lib/booking-timeline";
import type { BookingAdjustmentRow } from "@/features/bookings/lib/get-booking-adjustments";
import type { BookingEventItem } from "@/features/bookings/lib/get-booking-events";
import { ADJUSTMENT_GROUP_LABEL } from "@/features/bookings/schemas/adjustment.schema";
import {
  SOURCE_LABEL,
  describeChange,
} from "@/features/flights/lib/flight-update-format";
import type { FlightUpdateItem } from "@/features/flights/schemas/flight-update.schema";

interface BuildTimelineEntriesInput {
  events: readonly BookingEventItem[];
  /** `null` for a role that does not see adjustments (a partner user). */
  adjustments: readonly BookingAdjustmentRow[] | null;
  /** `null` when the booking has no flight. */
  flightUpdates: readonly FlightUpdateItem[] | null;
  timeZone: string;
}

/**
 * Server side: puts the booking events, the adjustments (Money) and the flight updates (Flight) in one list,
 * newest first. The order of equal times is the order of the sources, so the result is the same on each load.
 */
export function buildTimelineEntries({
  events,
  adjustments,
  flightUpdates,
  timeZone,
}: BuildTimelineEntriesInput): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...events.map(
      (event): TimelineEntry => ({
        kind: "event",
        id: `event-${event.id}`,
        category: getEventCategory(event),
        occurred_at: event.created_at,
        event,
      }),
    ),
    ...(adjustments ?? []).map(
      (adjustment): TimelineEntry => ({
        kind: "text",
        id: `adjustment-${adjustment.id}`,
        category: "money",
        occurred_at: adjustment.created_at,
        title: "Adjustment added",
        actor: adjustment.creator?.full_name ?? "Staff",
        lines: [
          `${ADJUSTMENT_GROUP_LABEL[adjustment.type]} · ${formatUsd(-adjustment.amount)}`,
        ],
        reason: adjustment.reason,
      }),
    ),
    ...(flightUpdates ?? []).map(
      (update): TimelineEntry => ({
        kind: "text",
        id: `flight-${update.id}`,
        category: "flight",
        occurred_at: update.occurred_at,
        title: "Flight updated",
        actor: SOURCE_LABEL[update.source],
        lines: update.changes.map((change) => describeChange(change, timeZone)),
        reason: null,
      }),
    ),
  ];

  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        Date.parse(b.entry.occurred_at) - Date.parse(a.entry.occurred_at) ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);
}
