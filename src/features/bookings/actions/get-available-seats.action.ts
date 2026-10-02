"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { availableSeatsQuerySchema } from "@/features/bookings/schemas/booking.schema";
import { zonedLocalToUtcIso } from "@/features/bookings/lib/booking-time";
import { getAirportTimezone } from "@/features/bookings/lib/get-airport-timezone";
import {
  VALIDATION_ERROR,
  mapBookingError,
  type BookingActionError,
} from "@/features/bookings/lib/booking-errors";

export interface AvailableSeat {
  id: string;
  serial_number: string;
}

export interface GetAvailableSeatsActionResult {
  success: boolean;
  seats?: AvailableSeat[];
  error?: BookingActionError;
}

/**
 * Read-only seat picker data (no mutation). Uses `public.get_available_seats()`
 * so the picker and the create/update RPC checks share one definition of
 * "available". Admin/ops only, like the forms that call it.
 */
export async function getAvailableSeatsAction(
  input: unknown,
): Promise<GetAvailableSeatsActionResult> {
  await requirePermission("bookings:manage");

  const parsed = availableSeatsQuerySchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const airport = await getAirportTimezone(supabase, parsed.data.airport_id);

  if (airport.error) {
    return { success: false, error: mapBookingError(airport.error) };
  }

  const pickupAt = airport.timezone
    ? zonedLocalToUtcIso(parsed.data.pickup_at, airport.timezone)
    : null;
  const returnAt = airport.timezone
    ? zonedLocalToUtcIso(parsed.data.return_at, airport.timezone)
    : null;

  if (!pickupAt || !returnAt || returnAt < pickupAt) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const { data, error } = await supabase.rpc("get_available_seats", {
    p_airport_id: parsed.data.airport_id,
    p_seat_category_id: parsed.data.seat_category_id,
    p_pickup_at: pickupAt,
    p_return_at: returnAt,
    p_exclude_booking_id: parsed.data.exclude_booking_id,
  });

  if (error) {
    return { success: false, error: mapBookingError(error) };
  }

  return { success: true, seats: data ?? [] };
}
