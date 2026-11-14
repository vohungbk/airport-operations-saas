"use client";

import { useEffect } from "react";

import { useBookingPhotoUpload } from "@/features/bookings/hooks/use-booking-photo-upload";
import { useSendBookingPhoto } from "@/features/bookings/hooks/use-send-booking-photo";
import type { BookingPhotoType } from "@/features/bookings/lib/booking-photos";
import { getStepPhotoStatus } from "@/features/bookings/lib/step-photo";

/**
 * The photos of a step that needs one (FO-F06-S06). The photos go to the booking of the step. When the
 * booking changes (an incident reported on another job) the list starts again, so a photo never stays
 * on a booking it does not belong to.
 */
export function useStepPhotoUpload(bookingId: string, type: BookingPhotoType) {
  const upload = useBookingPhotoUpload(useSendBookingPhoto(bookingId, type));
  const { reset } = upload;

  useEffect(() => reset, [bookingId, reset]);

  return { ...upload, ...getStepPhotoStatus(upload.items) };
}
