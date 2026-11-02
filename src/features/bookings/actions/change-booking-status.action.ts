"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { changeBookingStatusSchema } from "@/features/bookings/schemas/booking.schema";
import { checkStatusTransition } from "@/features/bookings/lib/booking-step-order";
import {
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  mapBookingError,
  type BookingActionResult,
} from "@/features/bookings/lib/booking-errors";

/**
 * Status changes go only through `public.change_booking_status()`, which
 * validates the transition under a row lock and (via trigger) writes the
 * `status_changed` event atomically. Never a direct `update({ status })`.
 * Before the call, the step order (CO-F08-S02) is checked against the current
 * status, so a skipped step or a change that is not allowed is refused with a
 * message that says why; the database still has the last word.
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

  const { data: current, error: readError } = await supabase
    .from("bookings")
    .select("status")
    .eq("id", parsed.data.booking_id)
    .maybeSingle();

  if (readError) {
    return { success: false, error: mapBookingError(readError) };
  }

  if (!current) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  const check = checkStatusTransition(current.status, parsed.data.to_status);

  if (!check.ok) {
    return {
      success: false,
      error: { code: "INVALID_TRANSITION", message: check.message },
    };
  }

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
