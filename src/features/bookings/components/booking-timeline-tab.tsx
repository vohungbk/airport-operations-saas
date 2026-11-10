"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";

import { BookingStatusBadge } from "@/features/bookings/components/booking-status-badge";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";
import {
  BOOKING_EVENTS_LIMIT,
  TIMELINE_FILTERS,
  filterTimelineEntries,
  formatTimelineTime,
  type TimelineEntry,
  type TimelineFilter,
} from "@/features/bookings/lib/booking-timeline";
import type { BookingEventItem } from "@/features/bookings/lib/get-booking-events";
import { cn } from "@/lib/utils";

interface BookingTimelineTabProps {
  /** Booking events, flight updates and adjustments, newest first (built on the server). */
  entries: TimelineEntry[];
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

function eventTitle(event: BookingEventItem): string {
  switch (event.event_type) {
    case "created":
      return "Booking created";
    case "status_changed":
      return "Status changed";
    case "seat_changed":
      return "Seat changed";
    case "updated":
      return "Booking updated";
    default:
      return "Booking changed";
  }
}

function EventDetail({
  event,
  timeZone,
}: {
  event: BookingEventItem;
  timeZone: string;
}) {
  if (event.event_type === "status_changed") {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-foreground">
        {event.from_status && <BookingStatusBadge status={event.from_status} />}
        {event.from_status && <span aria-hidden="true">→</span>}
        <BookingStatusBadge status={event.to_status} />
      </p>
    );
  }

  if (event.event_type === "seat_changed") {
    return (
      <p className="text-sm text-foreground">
        {event.from_seat_serial ?? "none"} → {event.to_seat_serial ?? "none"}
      </p>
    );
  }

  if (event.event_type === "updated" && event.changes) {
    return (
      <ul className="flex flex-col gap-1 text-sm text-foreground">
        {Object.entries(event.changes).map(([field, change]) => (
          <li key={field} className="break-words">
            {FIELD_LABEL[field] ?? field}:{" "}
            {formatChangeValue(field, change.from, timeZone)} →{" "}
            {formatChangeValue(field, change.to, timeZone)}
          </li>
        ))}
      </ul>
    );
  }

  return null;
}

/**
 * The Timeline tab of the booking page (UI-F06-T05): filter chips, then the events newest first, each with
 * an icon, its name, who did it, the time at the airport and the reason. Read only.
 */
export function BookingTimelineTab({
  entries,
  truncated = false,
  timeZone,
}: BookingTimelineTabProps) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const visible = filterTimelineEntries(entries, filter);

  return (
    <section
      data-slot="booking-timeline-tab"
      aria-label="Booking timeline"
      className="flex flex-col gap-4"
    >
      <div
        role="group"
        aria-label="Filter events"
        className="sticky top-0 z-10 -mx-1 flex gap-2 overflow-x-auto bg-card px-1 py-2"
      >
        {TIMELINE_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={cn(
              "min-h-11 shrink-0 rounded-md px-4 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              filter === item.value
                ? "bg-primary-subtle font-semibold text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p
          data-slot="timeline-empty"
          className="py-6 text-sm text-muted-foreground"
        >
          {entries.length === 0
            ? "No events recorded."
            : "No events of this type."}
        </p>
      ) : (
        <ol data-slot="timeline" className="flex min-w-0 flex-col gap-6">
          {visible.map((entry) => (
            <li key={entry.id} className="flex min-w-0 gap-3">
              <CircleCheck
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-primary"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">
                  {entry.kind === "event"
                    ? eventTitle(entry.event)
                    : entry.title}
                </p>
                <p className="text-sm break-words text-muted-foreground">
                  {entry.kind === "event"
                    ? (entry.event.actor_name ?? "Staff")
                    : entry.actor}
                </p>
                <time
                  dateTime={entry.occurred_at}
                  className="text-sm text-muted-foreground tabular-nums"
                >
                  {formatTimelineTime(
                    formatBookingDateTime(entry.occurred_at, timeZone),
                    timeZone,
                  )}
                </time>
                {entry.kind === "event" ? (
                  <>
                    <EventDetail event={entry.event} timeZone={timeZone} />
                    {entry.event.notes && (
                      <p className="text-sm break-words text-foreground">
                        Reason: {entry.event.notes}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {entry.lines.map((line) => (
                      <p
                        key={line}
                        className="text-sm break-words text-foreground"
                      >
                        {line}
                      </p>
                    ))}
                    {entry.reason && (
                      <p className="text-sm break-words text-foreground">
                        Reason: {entry.reason}
                      </p>
                    )}
                  </>
                )}
              </div>
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
