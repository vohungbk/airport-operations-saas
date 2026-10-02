"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { changeBookingStatusSchema } from "@/features/bookings/schemas/booking.schema";
import {
  VALIDATION_ERROR,
  mapBookingError,
  type BookingActionResult,
} from "@/features/bookings/lib/booking-errors";

/**
 * Status changes go only through `public.change_booking_status()`, which
 * validates the transition under a row lock and (via trigger) writes the
 * `status_changed` event atomically. Never a direct `update({ status })`.
 */
export async function changeBookingStatusAction(
  input: unknown,
): Promise<BookingActionResult> {
  await requirePermission("bookings:manage");

  const parsed = changeBookingStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_booking_status", {
    p_booking_id: parsed.data.booking_id,
    p_to_status: parsed.data.to_status,
    p_reason: parsed.data.reason ?? undefined,
  });

  if (error) {
    return { success: false, error: mapBookingError(error) };
  }

  return { success: true };
}
