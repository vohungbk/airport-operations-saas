import { createClient } from "@/lib/supabase/server";
import { bookingIdSchema } from "@/features/bookings/schemas/booking.schema";
import type { BookingEvent } from "@/features/bookings/types";

export type BookingEventType =
  | "created"
  | "updated"
  | "status_changed"
  | "seat_changed";

export type BookingEventItem = Pick<
  BookingEvent,
  "id" | "from_status" | "to_status" | "notes" | "created_at"
> & {
  event_type: BookingEventType | null;
  /** `null` when the actor is unknown or hidden by RLS (e.g. partners). */
  actor_name: string | null;
  from_seat_serial: string | null;
  to_seat_serial: string | null;
  /** Field-level before/after values of an `updated` event. */
  changes: Record<string, { from: unknown; to: unknown }> | null;
};

export const BOOKING_EVENTS_LIMIT = 100;

export interface BookingEventsResult {
  items: BookingEventItem[];
  truncated: boolean;
}

interface EventRow {
  id: string;
  from_status: BookingEvent["from_status"];
  to_status: BookingEvent["to_status"];
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string } | null;
}

const EVENT_TYPES: readonly string[] = [
  "created",
  "updated",
  "status_changed",
  "seat_changed",
];

function readSeatId(
  metadata: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

/**
 * Server-only, read-only, newest first. The log is append-only in the DB.
 * Fetches one extra row to know whether older events were cut off, then
 * resolves seat serial numbers for seat-change events with ONE `in` query
 * (not one per event).
 */
export async function getBookingEvents(
  bookingId: string,
): Promise<BookingEventsResult> {
  if (!bookingIdSchema.safeParse(bookingId).success) {
    return { items: [], truncated: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_events")
    .select(
      "id, from_status, to_status, notes, metadata, created_at, actor:users(full_name)",
    )
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(BOOKING_EVENTS_LIMIT + 1);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as EventRow[];
  const visible = rows.slice(0, BOOKING_EVENTS_LIMIT);

  const seatIds = new Set<string>();
  for (const row of visible) {
    for (const key of ["from_seat_id", "to_seat_id"]) {
      const seatId = readSeatId(row.metadata, key);
      if (seatId) seatIds.add(seatId);
    }
  }

  const serialBySeatId = new Map<string, string>();

  if (seatIds.size > 0) {
    const { data: seats, error: seatsError } = await supabase
      .from("seats")
      .select("id, serial_number")
      .in("id", [...seatIds]);

    if (seatsError) {
      throw seatsError;
    }

    for (const seat of seats ?? []) {
      serialBySeatId.set(seat.id, seat.serial_number);
    }
  }

  const serialOf = (seatId: string | null) =>
    seatId ? (serialBySeatId.get(seatId) ?? null) : null;

  const items = visible.map((row): BookingEventItem => {
    const rawType = row.metadata?.event_type;
    const rawChanges = row.metadata?.changes;

    return {
      id: row.id,
      from_status: row.from_status,
      to_status: row.to_status,
      notes: row.notes,
      created_at: row.created_at,
      event_type:
        typeof rawType === "string" && EVENT_TYPES.includes(rawType)
          ? (rawType as BookingEventType)
          : null,
      actor_name: row.actor?.full_name ?? null,
      from_seat_serial: serialOf(readSeatId(row.metadata, "from_seat_id")),
      to_seat_serial: serialOf(readSeatId(row.metadata, "to_seat_id")),
      changes:
        rawChanges && typeof rawChanges === "object"
          ? (rawChanges as BookingEventItem["changes"])
          : null,
    };
  });

  return { items, truncated: rows.length > BOOKING_EVENTS_LIMIT };
}
