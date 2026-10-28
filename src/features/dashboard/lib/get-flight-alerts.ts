import { createClient } from "@/lib/supabase/server";
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
}

interface FlightRow {
  id: string;
  flight_number: string;
  scheduled_arrival_at: string;
  estimated_arrival_at: string | null;
  actual_arrival_at: string | null;
  delay_minutes: number | null;
  airport: { timezone: string } | null;
  bookings: { booking_number: string }[] | null;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** The select is a runtime string, like the bookings list, so the nested relations are cast below. */
const FLIGHTS_SELECT =
  "id, flight_number, scheduled_arrival_at, estimated_arrival_at, actual_arrival_at, delay_minutes, airport:airports(timezone), bookings(booking_number)";

function formatArrival(flight: FlightRow, offset: number): string {
  const expected =
    flight.actual_arrival_at ??
    flight.estimated_arrival_at ??
    new Date(
      Date.parse(flight.scheduled_arrival_at) + offset * MINUTE_MS,
    ).toISOString();

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: flight.airport?.timezone ?? "UTC",
    timeZoneName: "short",
  }).format(new Date(expected));
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
      });
    }

    return alerts;
  } catch {
    return [];
  }
}
