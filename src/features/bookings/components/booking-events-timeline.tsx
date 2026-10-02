import { BookingStatusBadge } from "@/features/bookings/components/booking-status-badge";
import {
  BOOKING_EVENTS_LIMIT,
  type BookingEventItem,
} from "@/features/bookings/lib/get-booking-events";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";

interface BookingEventsTimelineProps {
  events: BookingEventItem[];
  truncated?: boolean;
  timeZone: string;
}

const FIELD_LABEL: Record<string, string> = {
  pickup_at: "Pickup",
  return_at: "Return",
  external_booking_number: "External booking number",
  child_age_band: "Child age band",
  child_height: "Child height",
  vehicle: "Vehicle",
  vehicle_bay: "Vehicle bay",
  notes: "Notes",
};

const TIME_FIELDS = new Set(["pickup_at", "return_at"]);

function formatChangeValue(
  field: string,
  value: unknown,
  timeZone: string,
): string {
  if (value === null || value === undefined || value === "") return "-";
  if (TIME_FIELDS.has(field) && typeof value === "string") {
    return formatBookingDateTime(value, timeZone);
  }
  return String(value);
}

function EventSummary({
  event,
  timeZone,
}: {
  event: BookingEventItem;
  timeZone: string;
}) {
  switch (event.event_type) {
    case "created":
      return <span>Booking created</span>;
    case "status_changed":
      return (
        <span className="flex flex-wrap items-center gap-2">
          Status changed
          {event.from_status && (
            <BookingStatusBadge status={event.from_status} />
          )}
          <span aria-hidden="true">→</span>
          <BookingStatusBadge status={event.to_status} />
        </span>
      );
    case "seat_changed":
      return (
        <span>
          Seat changed: {event.from_seat_serial ?? "none"} →{" "}
          {event.to_seat_serial ?? "none"}
        </span>
      );
    case "updated":
      return (
        <span className="flex flex-col gap-1">
          Booking updated
          {event.changes && (
            <ul className="list-disc pl-5 text-muted-foreground">
              {Object.entries(event.changes).map(([field, change]) => (
                <li key={field}>
                  {FIELD_LABEL[field] ?? field}:{" "}
                  {formatChangeValue(field, change.from, timeZone)} →{" "}
                  {formatChangeValue(field, change.to, timeZone)}
                </li>
              ))}
            </ul>
          )}
        </span>
      );
    default:
      return <span>Booking changed</span>;
  }
}

/** Read-only: the log is append-only in the database, with no edit UI. */
export function BookingEventsTimeline({
  events,
  truncated = false,
  timeZone,
}: BookingEventsTimelineProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="booking-events">
      <h2
        id="booking-events"
        className="text-lg font-semibold tracking-tight text-foreground"
      >
        Timeline
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events recorded.</p>
      ) : (
        <ol className="flex flex-col gap-3 border-l border-border pl-4">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-1 text-sm">
              <p className="text-xs text-muted-foreground">
                {formatBookingDateTime(event.created_at, timeZone)} ·{" "}
                {event.actor_name ?? "Staff"}
              </p>
              <EventSummary event={event} timeZone={timeZone} />
              {event.notes && (
                <p className="text-muted-foreground">Reason: {event.notes}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      {truncated ? (
        <p className="text-sm text-muted-foreground">
          Showing latest {BOOKING_EVENTS_LIMIT} events
        </p>
      ) : null}
    </section>
  );
}
