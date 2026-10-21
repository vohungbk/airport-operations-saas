"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { createPartnerBookingSchema } from "@/features/bookings/schemas/booking.schema";
import {
  resolveRpcArgs,
  toCreatePartnerBookingRpcArgs,
} from "@/features/bookings/lib/booking-rpc-args";
import { getAirportTimezone } from "@/features/bookings/lib/get-airport-timezone";
import {
  VALIDATION_ERROR,
  mapBookingError,
  type BookingActionResult,
} from "@/features/bookings/lib/booking-errors";

/**
 * A partner user creates a booking for their own partner (VI-F03-S03). The
 * input has no partner, seat, status or number, and the write goes only
 * through `public.create_partner_booking()`, which takes the partner from the
 * caller, checks the capacity and sets status `pending`. The permission check
 * here is the first layer; the function checks the caller again.
 */
export async function createPartnerBookingAction(
  input: unknown,
): Promise<BookingActionResult> {
  await requirePermission("bookings:manage_own_partner");

  const parsed = createPartnerBookingSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const airport = await getAirportTimezone(supabase, parsed.data.airport_id);

  if (airport.error) {
    return { success: false, error: mapBookingError(airport.error) };
  }

  const resolved = resolveRpcArgs(airport.timezone, (timeZone) =>
    toCreatePartnerBookingRpcArgs(parsed.data, timeZone),
  );

  if (resolved.error) {
    return { success: false, error: resolved.error };
  }

  const { data, error } = await supabase.rpc(
    "create_partner_booking",
    resolved.args,
  );

  if (error) {
    return { success: false, error: mapBookingError(error) };
  }

  redirect(`/bookings/${data.id}`);
}
