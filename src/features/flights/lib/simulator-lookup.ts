import { createClient } from "@/lib/supabase/server";
import { ENDED_BOOKING_STATUS_FILTER } from "@/features/bookings/lib/booking-status";
import { pickSimulatedFlight } from "@/features/flights/lib/build-simulated-flight";
import { getInstallationDeadline, type DeadlineJob } from "@/features/flights/lib/flight-panel";
import type { SimulatorFlightPreview } from "@/features/flights/lib/simulator-impact";

const FLIGHT_SELECT =
  "id, scheduled_arrival_at, airport:airports(code, name, timezone), bookings!inner(id, pickup_at, created_at, technician_jobs(deadline_at, status, job_type))";

interface LookupRow {
  scheduled_arrival_at: string;
  airport: { code: string; name: string; timezone: string } | null;
  bookings: { pickup_at: string; created_at: string; technician_jobs: DeadlineJob[] | null }[];
}

/**
 * VI-F02-T02: the flight the simulator screen shows for a number, with its first open booking (the oldest, the one
 * the Flight tab opens on). Several flights can share a number, so the one nearest to now is taken, as the Apply
 * action does. Server-only and read-only: RLS decides what the viewer sees. Null when no open booking has a flight
 * with this number; a failed read throws.
 */
export async function lookupSimulatorFlight(
  flight_number: string,
  now: Date = new Date(),
): Promise<SimulatorFlightPreview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flights")
    .select(FLIGHT_SELECT)
    .eq("flight_number", flight_number)
    .not("bookings.status", "in", ENDED_BOOKING_STATUS_FILTER);

  if (error) throw error;

  const flight = pickSimulatedFlight((data ?? []) as unknown as LookupRow[], now);

  if (!flight || !flight.airport) return null;

  const first = [...flight.bookings].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0];

  return {
    flight_number,
    airport_code: flight.airport.code,
    airport_name: flight.airport.name,
    time_zone: flight.airport.timezone,
    scheduled_arrival_at: flight.scheduled_arrival_at,
    booking: first
      ? { pickup_at: first.pickup_at, installation_deadline_at: getInstallationDeadline(first.technician_jobs) }
      : null,
  };
}

/** The airport the screen starts with, before a flight is chosen: the first by code, as the Flight board does. */
export async function getDefaultSimulatorAirport(): Promise<{ code: string; name: string; timezone: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("airports")
    .select("code, name, timezone")
    .order("code", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}
