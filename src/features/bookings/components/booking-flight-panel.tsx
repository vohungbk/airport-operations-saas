import { CircleAlertIcon, InfoIcon } from "lucide-react";

import { PageEmpty } from "@/components/shared/page-state";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";
import type { BookingFlight } from "@/features/bookings/lib/get-bookings";
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
  /** The name of that airport, for the heading of the flight. */
  airportName?: string;
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
  airportName,
}: BookingFlightPanelProps) {
  if (!flight) {
    return <PageEmpty message="No flight is linked to this booking." />;
  }

  const time = (iso: string | null) =>
    iso ? formatBookingDateTime(iso, timeZone) : "-";
  const offset = getFlightOffsetMinutes(flight);
  const timing = classifyFlight(offset);
  const minutes = offset === null ? 0 : Math.abs(offset);
  const age = getDataAgeMinutes(flight.last_synced_at, new Date());
  const showTiming =
    flight.status !== "cancelled" && flight.status !== "diverted";
  const late = timing === "delayed";
  const unit = minutes === 1 ? "MINUTE" : "MINUTES";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {showTiming && (timing === "early" || late) && (
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
              {flight.flight_number} · Estimated{" "}
              {time(flight.estimated_arrival_at)}.
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
          {airportName ? ` · ${airportName} arrival` : ""}
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge domain="flight" value={flight.status} />
            {showTiming && timing !== "unknown" && (
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
            {time(flight.scheduled_arrival_at)}
          </Row>
          <Row label={`Estimated · ${timeZone}`}>
            {time(flight.estimated_arrival_at)}
          </Row>
          {flight.actual_arrival_at && (
            <Row label={`Arrived · ${timeZone}`}>
              {time(flight.actual_arrival_at)}
            </Row>
          )}
        </dl>

        <p className="text-sm break-words text-muted-foreground">
          {flight.last_synced_at
            ? `Provider sync ${time(flight.last_synced_at)} · Updated ${formatAge(age)}`
            : "Never updated"}
          {isStale(age) && flight.last_synced_at ? ". Times may be wrong." : ""}
        </p>
      </section>
    </div>
  );
}
