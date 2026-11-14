import { z } from "zod";

import { BOOKING_PHOTO_CAPTION_MAX_LENGTH, BOOKING_PHOTO_TYPES } from "@/features/bookings/lib/booking-photos";

export const BOOKING_PHOTO_REQUIRED_MESSAGE = "Add a photo.";
export const BOOKING_PHOTO_CAPTION_TOO_LONG_MESSAGE = `The caption must be at most ${BOOKING_PHOTO_CAPTION_MAX_LENGTH} characters.`;

/** The caption of a photo (FO-F06-S01, V2): optional, at most 200 characters. Runs in the form and in the action. */
export const bookingPhotoCaptionSchema = z.string().trim().max(BOOKING_PHOTO_CAPTION_MAX_LENGTH, BOOKING_PHOTO_CAPTION_TOO_LONG_MESSAGE);

/**
 * Record an uploaded photo of a booking (FO-F06-S01, V1 and V2). The file type and size are checked by the
 * bucket; record_booking_photo() checks the role, the path and the caption again in the database.
 */
export const recordBookingPhotoSchema = z
  .object({
    // z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
    booking_id: z.guid("Booking not found."),
    type: z.enum(BOOKING_PHOTO_TYPES, { error: "This photo type is not valid." }),
    storage_path: z.string().min(1, BOOKING_PHOTO_REQUIRED_MESSAGE),
    caption: bookingPhotoCaptionSchema.optional().default(""),
  })
  .superRefine((value, ctx) => {
    const folder = `${value.booking_id}/${value.type}/`;

    if (!value.storage_path.startsWith(folder) || value.storage_path.includes("..", folder.length)) {
      ctx.addIssue({ code: "custom", path: ["storage_path"], message: BOOKING_PHOTO_REQUIRED_MESSAGE });
    }
  });
