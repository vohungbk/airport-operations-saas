import { CircleAlertIcon, InfoIcon } from "lucide-react";

import { PageEmpty } from "@/components/shared/page-state";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import type { BookingFlight } from "@/features/bookings/lib/get-bookings";
import {
  formatClock,
  formatFlightDateTime,
  getBannerDetail,
  getSyncNote,
  isFlightLanded,
  shouldShowStatusBadge,
} from "@/features/flights/lib/flight-panel";
import {
  classifyFlight,
  formatAge,
  getDataAgeMinutes,
  getFlightOffsetMinutes,
  isStale,
} from "@/lib/flights/flight-timing";

interface BookingFlightPanelProps {
  flight: BookingFlight | null;
  /** The time zone of the booking's airport; every time is shown in it. */
  timeZone: string;
  /** The city of that airport, for the heading of the flight. */
  city?: string;
  /** The deadline of the open installation job of the booking, and the pickup time it is counted from. */
  deadlineAt?: string | null;
  pickupAt?: string | null;
  /** The number the booking was saved with, and the result of looking it up (VI-F02-S01). */
  flightNumber?: string | null;
  lookupStatus?: string | null;
}

/**
 * What a booking with no linked flight says. No number: empty state (spec E1). The source did not
 * know the number: not found, and operations can enter the arrival by hand (spec E2). A number
 * whose lookup did not run is not linked yet.
 */
export function getUnlinkedMessage(
  flightNumber: string | null | undefined,
  lookupStatus: string | null | undefined,
): string {
  if (!flightNumber) return "No flight is linked to this booking.";
  if (lookupStatus === "not_found") {
    return `Flight ${flightNumber} was not found. Operations can enter the arrival by hand.`;
  }
  return `Flight ${flightNumber} is not linked yet.`;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 text-sm">
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-words text-foreground tabular-nums">
        {children}
      </dd>
    </div>
  );
}

/**
 * The Flight tab of a booking, laid out as the design draws it (UI-F06-S03): a banner when the flight is early
 * or late, then a card with the flight, its times at the airport and the age of the data. Nothing is made
 * up: a time that is not stored shows "-", and a booking with no flight says so.
 */
export function BookingFlightPanel({
  flight,
  timeZone,
  city,
  deadlineAt = null,
  pickupAt = null,
  flightNumber,
  lookupStatus,
}: BookingFlightPanelProps) {
  if (!flight) {
    return <PageEmpty message={getUnlinkedMessage(flightNumber, lookupStatus)} />;
  }

  const offset = getFlightOffsetMinutes(flight);
  const timing = classifyFlight(offset);
  const minutes = offset === null ? 0 : Math.abs(offset);
  const age = getDataAgeMinutes(flight.last_synced_at, new Date());
  const landed = isFlightLanded(flight.status);
  // A landed flight is final: no early or late banner, and its times are not "stale".
  const showTiming =
    flight.status !== "cancelled" && flight.status !== "diverted";
  const showBanner = showTiming && !landed;
  const hasTimingPill = showTiming && timing !== "unknown";
  const late = timing === "delayed";
  const unit = minutes === 1 ? "MINUTE" : "MINUTES";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {showBanner && (timing === "early" || late) && (
        <div
          role="status"
          data-slot="flight-banner"
          className="flex min-w-0 items-start gap-3 rounded-lg bg-info-bg p-4 text-sm text-info-fg"
        >
          <CircleAlertIcon className="size-5 shrink-0" aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-semibold break-words">
              {late
                ? `DELAYED ${minutes} ${unit}`
                : `ARRIVING ${minutes} ${unit} EARLY`}
            </p>
            <p className="break-words">
              {getBannerDetail(
                flight.flight_number,
                flight.estimated_arrival_at,
                deadlineAt,
                pickupAt,
                timeZone,
              )}
            </p>
          </div>
        </div>
      )}

      <section
        aria-labelledby="booking-flight"
        data-slot="booking-flight-card"
        className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5"
      >
        <h2
          id="booking-flight"
          className="text-base font-semibold break-words text-foreground"
        >
          {flight.flight_number}
          {city ? ` · ${city} arrival` : ""}
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {shouldShowStatusBadge(flight.status, hasTimingPill) && (
              <StatusBadge domain="flight" value={flight.status} />
            )}
            {hasTimingPill && (
              <Badge variant="info">
                <InfoIcon aria-hidden="true" />
                {timing === "on_time"
                  ? "On time"
                  : `${late ? "Delayed" : "Early"} ${minutes} min`}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {flight.terminal ? `Terminal ${flight.terminal}` : "Terminal -"}
          </p>
        </div>

        <dl className="flex flex-col gap-3">
          <Row label={`Scheduled · ${timeZone}`}>
            {formatFlightDateTime(flight.scheduled_arrival_at, timeZone)}
          </Row>
          <Row label={`Estimated · ${timeZone}`}>
            {formatFlightDateTime(flight.estimated_arrival_at, timeZone)}
          </Row>
          {flight.actual_arrival_at && (
            <Row label={`Arrived · ${timeZone}`}>
              {formatFlightDateTime(flight.actual_arrival_at, timeZone)}
            </Row>
          )}
          <Row label="Installation deadline">
            {deadlineAt ? formatClock(deadlineAt, timeZone) : "-"}
          </Row>
        </dl>

        <p className="text-sm break-words text-muted-foreground">
          {flight.last_synced_at
            ? `Provider sync ${formatClock(flight.last_synced_at, timeZone)} · Updated ${formatAge(age)}`
            : "Never updated"}
          {getSyncNote(flight.status, Boolean(flight.last_synced_at), isStale(age))}
        </p>
      </section>
    </div>
  );
}
