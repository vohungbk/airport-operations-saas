"use server";

import { forbidden } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  BOOKING_PHOTO_VALIDATION_ERROR,
  mapBookingPhotoError,
  type BookingPhotoActionResult,
} from "@/features/bookings/lib/booking-photo-errors";
import { recordBookingPhotoSchema } from "@/features/bookings/schemas/booking-photo.schema";

/**
 * Link an uploaded photo to a booking (FO-F06-S01). The browser has already put the file in the private
 * bucket, which accepts only a JPG or PNG of at most 2 MB. The database function checks the role, the
 * path and the caption again, and stores the photo with the actor and the time.
 */
export async function recordBookingPhotoAction(input: unknown): Promise<BookingPhotoActionResult> {
  await requirePermission("bookings:manage");

  const parsed = recordBookingPhotoSchema.safeParse(input);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: { ...BOOKING_PHOTO_VALIDATION_ERROR, message: issue?.message ?? BOOKING_PHOTO_VALIDATION_ERROR.message },
    };
  }

  const { booking_id, type, storage_path, caption } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_booking_photo", {
    p_booking_id: booking_id,
    p_type: type,
    p_path: storage_path,
    p_caption: caption,
  });

  if (error) {
    if (error.code === "42501") {
      forbidden();
    }

    return { success: false, error: mapBookingPhotoError(error) };
  }

  revalidatePath(`/bookings/${booking_id}`);

  return { success: true };
}
