import { createClient } from "@/lib/supabase/server";
import {
  BOOKING_PHOTOS_LIMIT,
  BOOKING_PHOTOS_SELECT,
  signBookingPhotos,
  type BookingPhotoRow,
  type BookingPhotosResult,
} from "@/features/bookings/lib/get-booking-photos";
import { seatIdSchema } from "@/features/seats/schemas/seat.schema";

const SEAT_PHOTOS_SELECT = `${BOOKING_PHOTOS_SELECT}, booking:bookings!inner(assigned_seat_id, airport:airports(timezone))`;

export interface SeatPhotosResult extends BookingPhotosResult {
  /** The time zone of the airport the photos were taken at; UTC when there is no photo. */
  time_zone: string;
}

interface SeatPhotoRow extends BookingPhotoRow {
  booking: { airport: { timezone: string } | null } | null;
}

/**
 * Server-only, with the user's own client: the photos of the bookings that have the seat (FO-F06-S05).
 * RLS on `booking_photos` decides who sees which row, so a seat of another tenant returns nothing.
 * Newest first, one query for the rows and one for all signed addresses. It never throws: a failure is
 * shown inside the viewer.
 */
export async function getSeatPhotos(seatId: string): Promise<SeatPhotosResult> {
  if (!seatIdSchema.safeParse(seatId).success) {
    return { photos: [], failed: false, time_zone: "UTC" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_photos")
    .select(SEAT_PHOTOS_SELECT)
    .eq("booking.assigned_seat_id", seatId)
    .order("created_at", { ascending: false })
    .limit(BOOKING_PHOTOS_LIMIT);

  if (error) {
    return { photos: [], failed: true, time_zone: "UTC" };
  }

  const rows = (data ?? []) as unknown as SeatPhotoRow[];
  const result = await signBookingPhotos(supabase, rows);

  return { ...result, time_zone: rows[0]?.booking?.airport?.timezone ?? "UTC" };
}
