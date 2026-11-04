import { createClient } from "@/lib/supabase/server";
import { OPEN_JOB_STATUSES } from "@/features/jobs/lib/job-deadline";
import type { JobStatus } from "@/features/jobs/lib/job-status";
import {
  classifyFlight,
  getFlightOffsetMinutes,
} from "@/lib/flights/flight-timing";

export interface FlightAlertItem {
  id: string;
  flight_number: string;
  kind: "early" | "delayed";
  /** Always positive. */
  minutes: number;
  /** The expected arrival, in the time zone of the airport (for example `15:45 GMT+4`). */
  arrival_label: string;
  /** A booking linked to the flight, or null when none is. */
  booking_number: string | null;
  /**
   * The new installation deadline, in the time zone of the airport, when the delay moved the deadline of
   * an open installation job of the linked booking; null for an early flight or when no job has one.
   */
  deadline_label: string | null;
}

interface FlightJobRow {
  deadline_at: string | null;
  status: JobStatus;
  job_type: string;
}

interface FlightRow {
  id: string;
  flight_number: string;
  scheduled_arrival_at: string;
  estimated_arrival_at: string | null;
  actual_arrival_at: string | null;
  delay_minutes: number | null;
  airport: { timezone: string } | null;
  bookings: { booking_number: string; technician_jobs: FlightJobRow[] | null }[] | null;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** The select is a runtime string, like the bookings list, so the nested relations are cast below. */
const FLIGHTS_SELECT =
  "id, flight_number, scheduled_arrival_at, estimated_arrival_at, actual_arrival_at, delay_minutes, airport:airports(timezone), bookings(booking_number, technician_jobs(deadline_at, status, job_type))";

function formatClock(iso: string, flight: FlightRow): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: flight.airport?.timezone ?? "UTC",
    timeZoneName: "short",
  }).format(new Date(iso));
}

function formatArrival(flight: FlightRow, offset: number): string {
  return formatClock(
    flight.actual_arrival_at ??
      flight.estimated_arrival_at ??
      new Date(
        Date.parse(flight.scheduled_arrival_at) + offset * MINUTE_MS,
      ).toISOString(),
    flight,
  );
}

/**
 * The deadline a delay moved: the earliest deadline of the open installation jobs of the first linked
 * booking, the booking the banner names. Nothing stored gives null, and no line is written.
 */
function formatMovedDeadline(flight: FlightRow): string | null {
  const deadlines = (flight.bookings?.[0]?.technician_jobs ?? [])
    .filter(
      (job) =>
        job.job_type === "installation" &&
        job.deadline_at !== null &&
        (OPEN_JOB_STATUSES as readonly JobStatus[]).includes(job.status),
    )
    .map((job) => job.deadline_at as string)
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  return deadlines.length > 0 ? formatClock(deadlines[0], flight) : null;
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
        deadline_label:
          timing === "delayed" ? formatMovedDeadline(flight) : null,
      });
    }

    return alerts;
  } catch {
    return [];
  }
}
