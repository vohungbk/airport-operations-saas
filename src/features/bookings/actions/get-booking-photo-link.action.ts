"use server";

import { forbidden } from "next/navigation";

import { requireAuth } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_PHOTO_LINK_ERROR, BOOKING_PHOTO_VALIDATION_ERROR, type BookingPhotoLinkResult } from "@/features/bookings/lib/booking-photo-errors";
import { BOOKING_PHOTO_BUCKET, BOOKING_PHOTO_SIGNED_URL_SECONDS } from "@/features/bookings/lib/booking-photos";
import { bookingPhotoLinkSchema } from "@/features/bookings/schemas/booking-photo.schema";

/**
 * A fresh, short-lived signed link of one photo (FO-F06-S04). The user opens a photo again after its link
 * has expired and gets a new one. The photo row is read with the user's own client, so RLS decides who may
 * see it; the link is returned to the caller and never stored.
 */
export async function getBookingPhotoLinkAction(input: unknown): Promise<BookingPhotoLinkResult> {
  await requireAuth();

  const parsed = bookingPhotoLinkSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? BOOKING_PHOTO_VALIDATION_ERROR.message } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("booking_photos").select("storage_path").eq("id", parsed.data.photo_id).maybeSingle();

  if (error) {
    if (error.code === "42501") {
      forbidden();
    }

    return { success: false, error: BOOKING_PHOTO_LINK_ERROR };
  }

  if (!data) {
    return { success: false, error: { code: "NOT_FOUND", message: "This photo is not available." } };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BOOKING_PHOTO_BUCKET)
    .createSignedUrl(data.storage_path, BOOKING_PHOTO_SIGNED_URL_SECONDS);

  if (signError || !signed?.signedUrl) {
    return { success: false, error: BOOKING_PHOTO_LINK_ERROR };
  }

  return { success: true, url: signed.signedUrl };
}
