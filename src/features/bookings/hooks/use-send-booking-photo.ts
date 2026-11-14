"use client";

import { useCallback } from "react";

import { recordBookingPhotoAction } from "@/features/bookings/actions/record-booking-photo.action";
import {
  BOOKING_PHOTO_BUCKET,
  BOOKING_PHOTO_SIGNED_URL_SECONDS,
  bookingPhotoPath,
  captionFromFileName,
  type BookingPhotoType,
} from "@/features/bookings/lib/booking-photos";
import type { SendBookingPhoto } from "@/features/bookings/hooks/use-booking-photo-upload";
import { createClient } from "@/lib/supabase/client";

/**
 * Sends one photo of a booking: the file goes straight to the private bucket (which refuses a wrong type
 * or a file over 2 MB), then the action links it to the booking. Resolves with a signed address to show
 * the thumbnail. The design has no caption field, so the caption is the file name.
 */
export function useSendBookingPhoto(bookingId: string, type: BookingPhotoType): SendBookingPhoto {
  return useCallback(
    async (file, onProgress) => {
      const supabase = createClient();
      const path = bookingPhotoPath(bookingId, type, crypto.randomUUID(), file.type);

      const { error } = await supabase.storage.from(BOOKING_PHOTO_BUCKET).upload(path, file, { contentType: file.type });
      if (error) throw error;
      onProgress(90);

      const outcome = await recordBookingPhotoAction({ booking_id: bookingId, type, storage_path: path, caption: captionFromFileName(file.name) });
      if (!outcome.success) throw new Error(outcome.error.message);

      const { data } = await supabase.storage.from(BOOKING_PHOTO_BUCKET).createSignedUrl(path, BOOKING_PHOTO_SIGNED_URL_SECONDS);

      return data?.signedUrl ?? "";
    },
    [bookingId, type],
  );
}
