"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import {
  bookingIdSchema,
  updateBookingSchema,
} from "@/features/bookings/schemas/booking.schema";
import {
  resolveRpcArgs,
  toUpdateBookingRpcArgs,
} from "@/features/bookings/lib/booking-rpc-args";
import {
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  mapBookingError,
  type BookingActionResult,
} from "@/features/bookings/lib/booking-errors";

/**
 * The schema has no `status`, `booking_number`, `partner_id`, category or
 * `daily_rate`, so the body can never change them; the write goes only
 * through `public.update_booking()`. The booking is read first only for its
 * airport timezone; a missing/RLS-hidden booking is `NOT_FOUND`.
 */
export async function updateBookingAction(
  bookingId: string,
  input: unknown,
): Promise<BookingActionResult> {
  await requirePermission("bookings:manage");

  const parsedId = bookingIdSchema.safeParse(bookingId);
  const parsed = updateBookingSchema.safeParse(input);

  if (!parsedId.success || !parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();

  const { data, error: bookingError } = await supabase
    .from("bookings")
    .select("id, airport_id, airport:airports(timezone)")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (bookingError) {
    return { success: false, error: mapBookingError(bookingError) };
  }

  if (!data) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  const booking = data as unknown as {
    airport: { timezone: string } | null;
  };
  const resolved = resolveRpcArgs(booking.airport?.timezone, (timeZone) =>
    toUpdateBookingRpcArgs(parsedId.data, parsed.data, timeZone),
  );

  if (resolved.error) {
    return { success: false, error: resolved.error };
  }

  const { error } = await supabase.rpc("update_booking", resolved.args);

  if (error) {
    return { success: false, error: mapBookingError(error) };
  }

  redirect(`/bookings/${parsedId.data}`);
}
