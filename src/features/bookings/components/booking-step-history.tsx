import { CheckIcon, CircleIcon } from "lucide-react";

import { PageEmpty } from "@/components/shared/page-state";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";
import {
  BOOKING_CREATED_TITLE,
  UNKNOWN_ACTOR_LABEL,
  formatStepDate,
  type StepHistoryRow,
} from "@/features/bookings/lib/booking-step-history";
import { BOOKING_EVENTS_LIMIT } from "@/features/bookings/lib/get-booking-events";

interface BookingStepHistoryProps {
  rows: StepHistoryRow[];
  timeZone: string;
  /** Older events were cut off. */
  truncated?: boolean;
}

/**
 * Who moved the booking to each step, and when, with the note they left, newest first. The log is
 * append-only in the database, so this list only ever grows.
 */
export function BookingStepHistory({ rows, timeZone, truncated = false }: BookingStepHistoryProps) {
  const newest = rows[0];

  return (
    <section
      aria-labelledby="booking-step-history-heading"
      className="flex flex-1 flex-col gap-4 rounded-lg border border-border bg-card p-6"
    >
      <h2 id="booking-step-history-heading" className="text-base font-semibold text-foreground">
        Step history
      </h2>
      {newest && (
        <p className="text-sm text-muted-foreground">
          {formatStepDate(newest.created_at, timeZone)} · {timeZone}
        </p>
      )}
      {rows.length === 0 ? (
        <PageEmpty message="No events recorded." />
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start gap-3 text-sm">
              {row.title === BOOKING_CREATED_TITLE ? (
                <CircleIcon aria-hidden="true" className="mt-1 size-3 shrink-0 text-muted-foreground" />
              ) : (
                <CheckIcon aria-hidden="true" className="mt-1 size-3 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{row.title}</p>
                <p className="text-muted-foreground">
                  {row.actor_name ?? UNKNOWN_ACTOR_LABEL} · {formatBookingDateTime(row.created_at, timeZone)}
                </p>
                {row.notes && <p className="text-muted-foreground break-words">{row.notes}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {truncated && (
        <p className="text-sm text-muted-foreground">Showing latest {BOOKING_EVENTS_LIMIT} events</p>
      )}
    </section>
  );
}
