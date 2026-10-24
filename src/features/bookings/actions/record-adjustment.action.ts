"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { FINANCE_ADJUSTMENT_PERMISSIONS } from "@/lib/auth/permissions";
import { canAddAdjustment } from "@/features/bookings/lib/booking-adjustment";
import {
  NOT_ADJUSTABLE_ERROR,
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  mapAdjustmentError,
  type AdjustmentActionResult,
} from "@/features/bookings/lib/adjustment-errors";
import { getBookingRevenue } from "@/features/bookings/lib/get-booking-revenue";
import { createAdjustmentSchema } from "@/features/bookings/schemas/adjustment.schema";

/**
 * VI-F04-S10 (R5): records a refund, an adjustment or a chargeback and, in the same database
 * transaction, calculates the booking again. The permission is checked here before anything is read;
 * the gross revenue the amount is checked against is read again here, not taken from the browser; the
 * database function checks the role and every rule once more. On success the user is taken back to
 * Booking revenue (NAV-2).
 */
export async function recordAdjustmentAction(
  bookingId: string,
  input: unknown,
): Promise<AdjustmentActionResult> {
  await requireAnyPermission(FINANCE_ADJUSTMENT_PERMISSIONS);

  const booking = await getBookingRevenue(bookingId);

  if (!booking) {
    return { success: false, error: NOT_FOUND_ERROR };
  }
  if (!canAddAdjustment(booking) || booking.gross_revenue === null) {
    return { success: false, error: NOT_ADJUSTABLE_ERROR };
  }

  const parsed = createAdjustmentSchema(booking.gross_revenue).safeParse(input);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path[0];
    return {
      success: false,
      error: {
        ...VALIDATION_ERROR,
        message: first?.message ?? VALIDATION_ERROR.message,
        field: field === "type" || field === "amount" || field === "reason" ? field : undefined,
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_booking_adjustment", {
    p_booking_id: booking.id,
    p_type: parsed.data.type,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return { success: false, error: mapAdjustmentError(error) };
  }

  revalidatePath(`/bookings/${booking.id}/revenue`);
  redirect(`/bookings/${booking.id}/revenue`);
}
