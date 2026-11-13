import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BOOKING_STATUSES } from "@/features/bookings/lib/booking-status";
import { formatClock, getInstallationDeadline, type DeadlineJob } from "@/features/flights/lib/flight-panel";
import { sortFlightAlerts } from "@/features/dashboard/lib/sort-flight-alerts";
import {
  classifyFlight,
  getFlightDisruption,
  getFlightOffsetMinutes,
  type FlightDisruption,
} from "@/lib/flights/flight-timing";

export interface FlightAlertItem {
  id: string;
  flight_number: string;
  kind: "early" | "delayed" | FlightDisruption;
  /** Always positive; 0 for a cancelled or diverted flight. */
  minutes: number;
  /** The expected arrival (the scheduled one for a cancelled or diverted flight), in the time zone of the airport (for example `15:45 GMT+4`). */
  arrival_label: string;
  /** A booking linked to the flight, or null when none is. */
  booking_number: string | null;
  /**
   * The moved installation deadline, in the time zone of the airport, of an open installation job of the
   * linked booking (a delay or an early arrival moved it); null when no job has one.
   */
  deadline_label: string | null;
}

interface FlightRow {
  id: string;
  flight_number: string;
  status: string;
  scheduled_arrival_at: string;
  estimated_arrival_at: string | null;
  actual_arrival_at: string | null;
  delay_minutes: number | null;
  airport: { timezone: string } | null;
  bookings: { booking_number: string; status: string; technician_jobs: DeadlineJob[] | null }[] | null;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** The select is a runtime string, like the bookings list, so the nested relations are cast below. */
const FLIGHTS_SELECT =
  "id, flight_number, status, scheduled_arrival_at, estimated_arrival_at, actual_arrival_at, delay_minutes, airport:airports(timezone), bookings(booking_number, status, technician_jobs(deadline_at, status, job_type))";

function clockAt(iso: string, flight: FlightRow): string {
  return formatClock(iso, flight.airport?.timezone ?? "UTC");
}

function formatArrival(flight: FlightRow, offset: number): string {
  return clockAt(
    flight.actual_arrival_at ??
      flight.estimated_arrival_at ??
      new Date(
        Date.parse(flight.scheduled_arrival_at) + offset * MINUTE_MS,
      ).toISOString(),
    flight,
  );
}

/**
 * The deadline a delay or an early arrival moved: the earliest deadline of the open installation jobs of the first linked
 * booking, the booking the banner names. Nothing stored gives null, and no line is written.
 */
function formatMovedDeadline(flight: FlightRow): string | null {
  const deadline = getInstallationDeadline(flight.bookings?.[0]?.technician_jobs);

  return deadline ? clockAt(deadline, flight) : null;
}

/**
 * Server-only. The flights around now that are early or late by the alert threshold, one early and one
 * delayed at most (the Command Centre shows a banner for each). It reads the flights the viewer's RLS
 * allows. A failed read gives no banner: a banner that is not shown is not a made-up one.
 */
export async function getFlightAlerts(
  now: Date = new Date(),
): Promise<FlightAlertItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("flights")
      .select(FLIGHTS_SELECT)
      .gte(
        "scheduled_arrival_at",
        new Date(now.getTime() - 12 * HOUR_MS).toISOString(),
      )
      .lte(
        "scheduled_arrival_at",
        new Date(now.getTime() + 24 * HOUR_MS).toISOString(),
      )
      .order("scheduled_arrival_at", { ascending: true })
      .limit(50);

    if (error || !data) return [];

    const alerts: FlightAlertItem[] = [];

    for (const flight of data as unknown as FlightRow[]) {
      const disruption = getFlightDisruption(flight.status);

      // A cancelled or diverted flight is flagged by its status; its old estimate is not read (VI-F02-S06).
      // The flag is for a booking that is still to be replanned: a finished or cancelled booking raises none.
      if (disruption) {
        const openBooking = flight.bookings?.find((booking) =>
          (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(booking.status),
        );

        if (openBooking && !alerts.some((alert) => alert.kind === disruption)) {
          alerts.push({
            id: flight.id,
            flight_number: flight.flight_number,
            kind: disruption,
            minutes: 0,
            arrival_label: clockAt(flight.scheduled_arrival_at, flight),
            booking_number: openBooking.booking_number,
            deadline_label: null,
          });
        }
        continue;
      }

      const offset = getFlightOffsetMinutes(flight);
      const timing = classifyFlight(offset);

      if (offset === null || (timing !== "early" && timing !== "delayed"))
        continue;
      if (alerts.some((alert) => alert.kind === timing)) continue;

      alerts.push({
        id: flight.id,
        flight_number: flight.flight_number,
        kind: timing,
        minutes: Math.abs(offset),
        arrival_label: formatArrival(flight, offset),
        booking_number: flight.bookings?.[0]?.booking_number ?? null,
        deadline_label: formatMovedDeadline(flight),
      });
    }

    return sortFlightAlerts(alerts);
  } catch {
    return [];
  }
}
