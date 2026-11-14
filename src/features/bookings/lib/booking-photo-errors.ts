import type { PostgrestError } from "@supabase/supabase-js";

import {
  BOOKING_PHOTO_CAPTION_TOO_LONG_MESSAGE,
  BOOKING_PHOTO_REQUIRED_MESSAGE,
} from "@/features/bookings/schemas/booking-photo.schema";

/** Stable error shape of the Upload photo action. Raw Postgres errors never reach the client. */
export interface BookingPhotoActionError {
  code: "VALIDATION_ERROR" | "PHOTO_REQUIRED" | "NOT_FOUND" | "INTERNAL_ERROR";
  message: string;
}

export type BookingPhotoActionResult = { success: true } | { success: false; error: BookingPhotoActionError };

export const BOOKING_PHOTO_VALIDATION_ERROR: BookingPhotoActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the photo and try again.",
};

const DB_PHOTO_REQUIRED_MESSAGE = "A photo is required";
const DB_CAPTION_MESSAGE = "The caption must be at most 200 characters";

/**
 * Maps an error of record_booking_photo() to the stable shape. Pure.
 * `42501` is not mapped here: the action shows the forbidden state for it.
 */
export function mapBookingPhotoError(error: Pick<PostgrestError, "code" | "message">): BookingPhotoActionError {
  switch (error.code) {
    case "P0002":
      return { code: "NOT_FOUND", message: "This booking no longer exists." };
    case "22023":
      if (error.message === DB_PHOTO_REQUIRED_MESSAGE) {
        return { code: "PHOTO_REQUIRED", message: BOOKING_PHOTO_REQUIRED_MESSAGE };
      }
      if (error.message === DB_CAPTION_MESSAGE) {
        return { code: "VALIDATION_ERROR", message: BOOKING_PHOTO_CAPTION_TOO_LONG_MESSAGE };
      }
      return BOOKING_PHOTO_VALIDATION_ERROR;
    default:
      return { code: "INTERNAL_ERROR", message: "Something went wrong. Try again." };
  }
}

/** Result of asking for a fresh signed link of one photo (FO-F06-S04). Raw storage errors never reach the client. */
export type BookingPhotoLinkResult =
  | { success: true; url: string }
  | { success: false; error: BookingPhotoActionError };

/** The photo link could not be requested (storage or network). */
export const BOOKING_PHOTO_LINK_ERROR: BookingPhotoActionError = {
  code: "INTERNAL_ERROR",
  message: "The photo could not be opened. Try again.",
};
