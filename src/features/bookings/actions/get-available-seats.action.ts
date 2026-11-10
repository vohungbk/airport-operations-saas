"use server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { requirePermission } from "@/lib/auth/current-user";
import { availableSeatsQuerySchema } from "@/features/bookings/schemas/booking.schema";
import { zonedLocalToUtcIso } from "@/features/bookings/lib/booking-time";
import { getAirportTimezone } from "@/features/bookings/lib/get-airport-timezone";
import {
  VALIDATION_ERROR,
  mapBookingError,
  type BookingActionError,
} from "@/features/bookings/lib/booking-errors";

type SeatOptionRow =
  Database["public"]["Functions"]["get_booking_seat_options"]["Returns"][number];

export type SeatAvailability = "available" | "conflict" | "not_usable";

/** A seat in the picker with its state for the chosen period. */
export interface AvailableSeat {
  id: string;
  serial_number: string;
  availability: SeatAvailability;
  /** The booking that holds the seat; set only when `availability` is `conflict`. */
  conflict_booking_number: string | null;
  /** Why the seat cannot be used; set only when `availability` is `not_usable`. */
  unusable_reason: string | null;
}

export interface GetAvailableSeatsActionResult {
  success: boolean;
  seats?: AvailableSeat[];
  error?: BookingActionError;
}

/**
 * Read-only seat picker data (no mutation). Uses `public.get_booking_seat_options()`:
 * every seat of the airport and category with its state (available, conflict or
 * not usable). The create/update RPC still checks the chosen seat again.
 * Admin/ops only, like the forms that call it.
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

  const { data, error } = await supabase.rpc("get_booking_seat_options", {
    p_airport_id: parsed.data.airport_id,
    p_seat_category_id: parsed.data.seat_category_id,
    p_pickup_at: pickupAt,
    p_return_at: returnAt,
    p_exclude_booking_id: parsed.data.exclude_booking_id,
  });

  if (error) {
    return { success: false, error: mapBookingError(error) };
  }

  const seats: AvailableSeat[] = ((data ?? []) as SeatOptionRow[]).map((row) => ({
    id: row.id,
    serial_number: row.serial_number,
    availability:
      row.availability === "conflict" || row.availability === "not_usable"
        ? row.availability
        : "available",
    conflict_booking_number: row.conflict_booking_number,
    unusable_reason: row.unusable_reason,
  }));

  return { success: true, seats };
}
