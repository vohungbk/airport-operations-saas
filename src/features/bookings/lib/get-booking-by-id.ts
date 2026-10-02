import { createClient } from "@/lib/supabase/server";
import {
  BOOKING_WITH_RELATIONS_SELECT,
  type BookingDetailItem,
} from "@/features/bookings/lib/get-bookings";
import { bookingIdSchema } from "@/features/bookings/schemas/booking.schema";

/**
 * Server-only. Returns `null` for an unknown id, an id RLS hides, or a
 * malformed id — the caller turns that into `notFound()`.
 */
export async function getBookingById(
  id: string,
): Promise<BookingDetailItem | null> {
  if (!bookingIdSchema.safeParse(id).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_WITH_RELATIONS_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as BookingDetailItem | null;
}
