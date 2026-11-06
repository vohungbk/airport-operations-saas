import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { normalizeFlightNumber } from "./flight-number";
import { getFlightSource } from "./provider/get-flight-source";
import type { FlightSnapshot, FlightSourceAdapter } from "./provider/flight-source";

/**
 * - `linked`: the source knows the flight and the booking points at it.
 * - `not_found`: the source does not know the number; operations can enter the arrival by hand.
 * - `cleared`: the booking has no flight number, so no flight is linked and nothing is looked up.
 * - `unavailable`: the lookup could not run (the source failed, or a write failed). The booking is
 *   already saved and keeps its number; provider errors are handled by VI-F02-S11.
 */
export type FlightLinkResult = "linked" | "not_found" | "cleared" | "unavailable";

interface LinkableBooking {
  id: string;
  airport_id: string;
  /** The number and lookup result the booking had before this save; absent for a new booking. */
  flight_number?: string | null;
  flight_lookup_status?: string | null;
}

type Client = SupabaseClient<Database>;

async function saveFlight(
  supabase: Client,
  airport_id: string,
  snapshot: FlightSnapshot,
  source: FlightSourceAdapter["source"],
): Promise<string> {
  const values = {
    status: snapshot.status,
    estimated_arrival_at: snapshot.estimated_arrival_at,
    actual_arrival_at: snapshot.actual_arrival_at,
    terminal: snapshot.terminal,
    delay_minutes: snapshot.delay_minutes,
    provider: source,
    last_synced_at: new Date().toISOString(),
    // The source has answered: its data wins over an arrival entered by hand (VI-F02-S07, Q4).
    manual_entered_at: null,
    manual_reason: null,
  };

  const existing = await supabase
    .from("flights")
    .select("id")
    .eq("flight_number", snapshot.flight_number)
    .eq("airport_id", airport_id)
    .eq("scheduled_arrival_at", snapshot.scheduled_arrival_at)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data) {
    const updated = await supabase.from("flights").update(values).eq("id", existing.data.id);
    if (updated.error) throw updated.error;
    return existing.data.id;
  }

  const inserted = await supabase
    .from("flights")
    .insert({
      ...values,
      flight_number: snapshot.flight_number,
      airport_id,
      scheduled_arrival_at: snapshot.scheduled_arrival_at,
    })
    .select("id")
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data.id;
}

/**
 * VI-F02-S01 (spec R6, E1, E2): after a booking is saved, look its flight number up in the active
 * source and link the flight. Server-only; it runs as the signed-in user, so RLS decides who may
 * write `flights` and `bookings`. It never throws: the booking is already saved.
 */
export async function linkBookingFlight(
  supabase: Client,
  booking: LinkableBooking,
  flight_number: string | undefined,
  source: () => FlightSourceAdapter = getFlightSource,
): Promise<FlightLinkResult> {
  const number = normalizeFlightNumber(flight_number ?? "");

  try {
    if (number === "") {
      // Nothing was linked and nothing is asked for: no write, so `updated_at` does not move.
      if (!booking.flight_number) return "cleared";

      const cleared = await supabase
        .from("bookings")
        .update({ flight_id: null, flight_number: null, flight_lookup_status: null })
        .eq("id", booking.id);

      return cleared.error ? "unavailable" : "cleared";
    }

    // The same number that is already linked: the source is not asked again on every save.
    if (booking.flight_number === number && booking.flight_lookup_status === "linked") {
      return "linked";
    }

    const adapter = source();
    const snapshot = await adapter.fetchFlight(number);

    if (!snapshot) {
      const missing = await supabase
        .from("bookings")
        .update({ flight_id: null, flight_number: number, flight_lookup_status: "not_found" })
        .eq("id", booking.id);

      return missing.error ? "unavailable" : "not_found";
    }

    const flightId = await saveFlight(supabase, booking.airport_id, snapshot, adapter.source);
    const linked = await supabase
      .from("bookings")
      .update({ flight_id: flightId, flight_number: number, flight_lookup_status: "linked" })
      .eq("id", booking.id);

    return linked.error ? "unavailable" : "linked";
  } catch {
    // Keep the number so the lookup can be retried; a failure here changes nothing more.
    await supabase
      .from("bookings")
      .update({ flight_id: null, flight_number: number, flight_lookup_status: null })
      .eq("id", booking.id)
      .then(
        () => undefined,
        () => undefined,
      );

    return "unavailable";
  }
}
