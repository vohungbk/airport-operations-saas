"use server";

import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { zonedLocalToUtcIso } from "@/features/bookings/lib/booking-time";
import { buildManualArrival } from "@/features/flights/lib/build-manual-arrival";
import {
  BOOKING_ENDED_ERROR,
  INTERNAL_ERROR,
  NO_CHANGE_ERROR,
  NO_FLIGHT_NUMBER_ERROR,
  NOT_FOUND_ERROR,
  STALE_DATA_ERROR,
  VALIDATION_ERROR,
  mapManualArrivalError,
  type ManualArrivalResult,
} from "@/features/flights/lib/manual-arrival-errors";
import { ENDED_BOOKING_STATUS_LIST } from "@/features/bookings/lib/booking-status";
import {
  createManualArrivalSchema,
  manualArrivalActionSchema,
} from "@/features/flights/schemas/manual-arrival.schema";
import type { StoredFlightValues } from "@/features/flights/lib/flight-diff";

const BOOKING_SELECT =
  "id, status, flight_number, flight_id, airport:airports(timezone), flight:flights(scheduled_arrival_at, status, estimated_arrival_at, actual_arrival_at, terminal, delay_minutes, last_synced_at)";

interface BookingRow {
  id: string;
  status: string;
  flight_number: string | null;
  flight_id: string | null;
  airport: { timezone: string } | null;
  flight: (StoredFlightValues & { scheduled_arrival_at: string; last_synced_at: string | null }) | null;
}

function validationFailure(details: { field: string; issue: string }[]): ManualArrivalResult {
  return { success: false, error: { ...VALIDATION_ERROR, details } };
}

/**
 * VI-F02-S07 (spec E6, Q4): stores an arrival entered by hand, with a required reason, and marks the flight
 * Manual until the provider answers after it. Only an admin or an operations manager; the role is checked here
 * and again by the database function that writes. For a booking whose flight the provider did not know, the
 * scheduled arrival is asked too and the flight is made and linked. No service-role client is used.
 */
export async function enterManualArrivalAction(input: unknown): Promise<ManualArrivalResult> {
  await requireRole(["admin", "operations_manager"]);

  const parsed = manualArrivalActionSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(
      parsed.error.issues.map((issue) => ({ field: String(issue.path[0] ?? ""), issue: issue.message })),
    );
  }

  const supabase = await createClient();
  const { data, error: readError } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("id", parsed.data.booking_id)
    .maybeSingle();

  if (readError) return { success: false, error: mapManualArrivalError(readError) };

  const booking = data as unknown as BookingRow | null;

  if (!booking) return { success: false, error: NOT_FOUND_ERROR };
  if ((ENDED_BOOKING_STATUS_LIST as readonly string[]).includes(booking.status)) return { success: false, error: BOOKING_ENDED_ERROR };
  if (!booking.flight_number) return { success: false, error: NO_FLIGHT_NUMBER_ERROR };

  const timeZone = booking.airport?.timezone;
  const flight = booking.flight_id ? booking.flight : null;

  if (!timeZone || (booking.flight_id && !flight)) return { success: false, error: INTERNAL_ERROR };

  // A booking with no flight yet needs the scheduled arrival too: it is the flight that is made.
  if (!flight) {
    const strict = createManualArrivalSchema({ requireScheduled: true }).safeParse(parsed.data);

    if (!strict.success) {
      return validationFailure(
        strict.error.issues.map((issue) => ({ field: String(issue.path[0] ?? ""), issue: issue.message })),
      );
    }
  }

  const arrivalIso = zonedLocalToUtcIso(parsed.data.arrival_at, timeZone);
  const scheduledIso = flight
    ? flight.scheduled_arrival_at
    : zonedLocalToUtcIso(parsed.data.scheduled_arrival_at, timeZone);

  if (!arrivalIso || !scheduledIso) return { success: false, error: INTERNAL_ERROR };

  const { values, changes } = buildManualArrival(flight, scheduledIso, arrivalIso);

  if (changes.length === 0) return { success: false, error: NO_CHANGE_ERROR };

  const { data: stored, error } = await supabase.rpc("enter_manual_arrival", {
    p_booking_id: booking.id,
    p_values: values,
    p_changes: changes,
    p_reason: parsed.data.reason,
    ...(flight ? {} : { p_scheduled_arrival_at: scheduledIso }),
    ...(flight?.last_synced_at ? { p_expected_synced_at: flight.last_synced_at } : {}),
  });

  if (error) return { success: false, error: mapManualArrivalError(error) };

  // The flight was refreshed since it was read: its answer is the newer one, and nothing was written.
  if (!stored) return { success: false, error: STALE_DATA_ERROR };

  return { success: true };
}
