"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { zonedLocalToUtcIso } from "@/features/bookings/lib/booking-time";
import { buildBookingTabHref } from "@/features/bookings/lib/booking-tabs";
import {
  buildSimulatedChange,
  pickBookingForFlight,
  pickSimulatedFlight,
  type SimulatorFlightRow,
} from "@/features/flights/lib/build-simulated-flight";
import {
  FLIGHT_NOT_FOUND_ERROR,
  INTERNAL_ERROR,
  SOURCE_NOT_SIMULATOR_ERROR,
  STALE_DATA_ERROR,
  VALIDATION_ERROR,
  mapSimulatorError,
  type FlightSimulatorResult,
} from "@/features/flights/lib/flight-simulator-errors";
import { ENDED_BOOKING_STATUSES } from "@/features/flights/lib/refresh-flights";
import { getFlightSourceConfig } from "@/features/flights/lib/provider/provider-config";
import { flightSimulatorSchema } from "@/features/flights/schemas/flight-simulator.schema";

const FLIGHT_SELECT =
  "id, status, scheduled_arrival_at, estimated_arrival_at, actual_arrival_at, terminal, delay_minutes, last_synced_at, bookings!inner(id, created_at), airport:airports(timezone)";

/**
 * VI-F02-S12 (spec R4): stores a simulated flight change like a provider update and opens the Flight status
 * panel of the booking. Only an admin; the role is checked here and again by the database function that writes.
 * It works only when the active source is the simulator. The write is `apply_simulated_flight_change()`, so no
 * service-role client is used.
 */
export async function applyFlightSimulationAction(input: unknown): Promise<FlightSimulatorResult> {
  await requireRole(["admin"]);

  const parsed = flightSimulatorSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: {
        ...VALIDATION_ERROR,
        details: parsed.error.issues.map((issue) => ({
          field: String(issue.path[0] ?? ""),
          issue: issue.message,
        })),
      },
    };
  }

  try {
    if (getFlightSourceConfig().source !== "simulator") {
      return { success: false, error: SOURCE_NOT_SIMULATOR_ERROR };
    }
  } catch {
    return { success: false, error: INTERNAL_ERROR };
  }

  const supabase = await createClient();
  const { data, error: readError } = await supabase
    .from("flights")
    .select(FLIGHT_SELECT)
    .eq("flight_number", parsed.data.flight_number)
    .not("bookings.status", "in", ENDED_BOOKING_STATUSES);

  if (readError) {
    return { success: false, error: mapSimulatorError(readError) };
  }

  const rows = (data ?? []) as unknown as (SimulatorFlightRow & { airport: { timezone: string } | null })[];
  const flight = pickSimulatedFlight(rows, new Date());
  const bookingId = flight ? pickBookingForFlight(flight.bookings) : null;

  if (!flight || !bookingId) {
    return { success: false, error: FLIGHT_NOT_FOUND_ERROR };
  }

  const estimated_arrival_at = flight.airport
    ? zonedLocalToUtcIso(parsed.data.estimated_arrival_at, flight.airport.timezone)
    : null;

  if (!estimated_arrival_at) {
    return { success: false, error: INTERNAL_ERROR };
  }

  const { values, changes } = buildSimulatedChange(flight, {
    estimated_arrival_at,
    status: parsed.data.status,
  });

  const { data: stored, error } = await supabase.rpc("apply_simulated_flight_change", {
    p_flight_id: flight.id,
    p_values: values,
    p_changes: changes,
    ...(flight.last_synced_at ? { p_expected_synced_at: flight.last_synced_at } : {}),
  });

  if (error) {
    return { success: false, error: mapSimulatorError(error) };
  }

  if (!stored) {
    return { success: false, error: STALE_DATA_ERROR };
  }

  redirect(buildBookingTabHref(bookingId, "flight"));
}
