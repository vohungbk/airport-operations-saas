"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { JOB_STATUS_UPDATE_PERMISSIONS } from "@/lib/auth/permissions";
import { getNextStep } from "@/features/bookings/lib/booking-move";
import {
  VALIDATION_ERROR,
  type BookingActionResult,
} from "@/features/bookings/lib/booking-errors";
import { mapMoveError } from "@/features/bookings/lib/move-booking-errors";
import { moveBookingSchema } from "@/features/bookings/schemas/booking.schema";

/**
 * Moves a booking to its next step, and its seat follows, only through
 * `public.move_booking_to_next_step()` (CO-F08-S03). The function decides who may move to which step
 * (managers any step, the assigned technician the field steps), locks the booking and refuses the
 * move when the booking is no longer at `expected_status`. This action only validates the input and
 * checks that the person has some right to move a booking: managers and technicians.
 */
export async function moveBookingAction(input: unknown): Promise<BookingActionResult> {
  await requireAnyPermission(JOB_STATUS_UPDATE_PERMISSIONS);

  const parsed = moveBookingSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const step = getNextStep(parsed.data.expected_status);

  if (!step) {
    return {
      success: false,
      error: { code: "INVALID_TRANSITION", message: "This booking has no next step." },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_booking_to_next_step", {
    p_booking_id: parsed.data.booking_id,
    p_expected_status: parsed.data.expected_status,
    p_note: parsed.data.note ?? undefined,
  });

  if (error) {
    return { success: false, error: mapMoveError(error, step) };
  }

  return { success: true, moved_to: step };
}
