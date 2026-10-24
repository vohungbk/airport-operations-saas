import { createClient } from "@/lib/supabase/server";
import { bookingIdSchema } from "@/features/bookings/schemas/booking.schema";
import type { AdjustmentType } from "@/features/bookings/schemas/adjustment.schema";

export interface BookingAdjustmentRow {
  id: string;
  type: AdjustmentType;
  amount: number;
  reason: string;
  created_at: string;
}

/** Explicit columns (VI-F04-S10): the history of one booking. Not who recorded it. */
export const BOOKING_ADJUSTMENTS_SELECT = "id, type, amount, reason, created_at";

/** More than this many adjustments of one booking is not expected. */
export const BOOKING_ADJUSTMENTS_LIMIT = 100;

/**
 * Server-only, with the user's own client: RLS gives an admin and an operations manager every
 * adjustment and a partner user only those of its own partner's bookings. Newest first. The reason
 * is a note for the operations team: the caller decides who is shown the list.
 */
export async function getBookingAdjustments(bookingId: string): Promise<BookingAdjustmentRow[]> {
  if (!bookingIdSchema.safeParse(bookingId).success) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_adjustments")
    .select(BOOKING_ADJUSTMENTS_SELECT)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(BOOKING_ADJUSTMENTS_LIMIT);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as BookingAdjustmentRow[];
}
