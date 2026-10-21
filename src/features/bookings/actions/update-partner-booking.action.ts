"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import {
  bookingIdSchema,
  updatePartnerBookingSchema,
} from "@/features/bookings/schemas/booking.schema";
import {
  resolveRpcArgs,
  toUpdatePartnerBookingRpcArgs,
} from "@/features/bookings/lib/booking-rpc-args";
import {
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  mapBookingError,
  type BookingActionResult,
} from "@/features/bookings/lib/booking-errors";

/**
 * A partner user edits a pending booking of their own partner (VI-F03-S03).
 * The booking is read first only for its airport's timezone: RLS shows a
 * partner user only their own partner's rows, so another partner's booking is
 * `NOT_FOUND`, the same as one that does not exist. The write goes only
 * through `public.update_partner_booking()`, which checks the scope, the
 * `pending` status, the lost-update guard and the capacity again.
 */
export async function updatePartnerBookingAction(
  bookingId: string,
  input: unknown,
): Promise<BookingActionResult> {
  await requirePermission("bookings:manage_own_partner");

  const parsedId = bookingIdSchema.safeParse(bookingId);
  const parsed = updatePartnerBookingSchema.safeParse(input);

  if (!parsedId.success || !parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();

  const { data, error: bookingError } = await supabase
    .from("bookings")
    .select("id, airport:airports(timezone)")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (bookingError) {
    return { success: false, error: mapBookingError(bookingError) };
  }

  if (!data) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  const booking = data as unknown as { airport: { timezone: string } | null };
  const resolved = resolveRpcArgs(booking.airport?.timezone, (timeZone) =>
    toUpdatePartnerBookingRpcArgs(parsedId.data, parsed.data, timeZone),
  );

  if (resolved.error) {
    return { success: false, error: resolved.error };
  }

  const { error } = await supabase.rpc("update_partner_booking", resolved.args);

  if (error) {
    return { success: false, error: mapBookingError(error) };
  }

  redirect(`/bookings/${parsedId.data}`);
}
