"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { createBookingSchema } from "@/features/bookings/schemas/booking.schema";
import {
  resolveRpcArgs,
  toCreateBookingRpcArgs,
} from "@/features/bookings/lib/booking-rpc-args";
import { getAirportTimezone } from "@/features/bookings/lib/get-airport-timezone";
import {
  VALIDATION_ERROR,
  mapBookingError,
  type BookingActionResult,
} from "@/features/bookings/lib/booking-errors";

/**
 * The insert goes only through `public.create_booking()`; the client can
 * never set status, number or finance fields.
 */
export async function createBookingAction(
  input: unknown,
): Promise<BookingActionResult> {
  await requirePermission("bookings:manage");

  const parsed = createBookingSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const airport = await getAirportTimezone(supabase, parsed.data.airport_id);

  if (airport.error) {
    return { success: false, error: mapBookingError(airport.error) };
  }

  const resolved = resolveRpcArgs(airport.timezone, (timeZone) =>
    toCreateBookingRpcArgs(parsed.data, timeZone),
  );

  if (resolved.error) {
    return { success: false, error: resolved.error };
  }

  const { data, error } = await supabase.rpc("create_booking", resolved.args);

  if (error) {
    return { success: false, error: mapBookingError(error) };
  }

  redirect(`/bookings/${data.id}`);
}
