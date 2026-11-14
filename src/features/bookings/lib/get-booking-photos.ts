import { createClient } from "@/lib/supabase/server";
import { BOOKING_PHOTO_BUCKET, BOOKING_PHOTO_SIGNED_URL_SECONDS, type BookingPhoto, type BookingPhotoType } from "@/features/bookings/lib/booking-photos";
import { bookingIdSchema } from "@/features/bookings/schemas/booking.schema";

export const BOOKING_PHOTOS_SELECT = "id, type, storage_path, caption, created_at, uploader:users!uploaded_by(full_name)";

/** More than this many photos of one booking is not expected. */
export const BOOKING_PHOTOS_LIMIT = 100;

export interface BookingPhotosResult {
  photos: BookingPhoto[];
  /** The photos could not be read: the tab shows its error state, the rest of the page stays. */
  failed: boolean;
}

interface BookingPhotoRow {
  id: string;
  type: BookingPhotoType;
  storage_path: string;
  caption: string | null;
  created_at: string;
  uploader: { full_name: string } | null;
}

/**
 * Server-only, with the user's own client: RLS lets only admin and operations manager read the photos.
 * Newest first, one query for the rows and one for all signed addresses (no query per photo). It never
 * throws: a failure is shown inside the Photos tab.
 */
export async function getBookingPhotos(bookingId: string): Promise<BookingPhotosResult> {
  if (!bookingIdSchema.safeParse(bookingId).success) {
    return { photos: [], failed: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_photos")
    .select(BOOKING_PHOTOS_SELECT)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(BOOKING_PHOTOS_LIMIT);

  if (error) {
    return { photos: [], failed: true };
  }

  const rows = (data ?? []) as unknown as BookingPhotoRow[];

  if (rows.length === 0) {
    return { photos: [], failed: false };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BOOKING_PHOTO_BUCKET)
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      BOOKING_PHOTO_SIGNED_URL_SECONDS,
    );

  if (signError) {
    return { photos: [], failed: true };
  }

  const urlByPath = new Map((signed ?? []).flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [])));

  return {
    photos: rows.flatMap((row) => {
      const url = urlByPath.get(row.storage_path);

      return url
        ? [{ id: row.id, url, caption: row.caption, type: row.type, uploader_name: row.uploader?.full_name ?? null, taken_at: row.created_at }]
        : [];
    }),
    failed: false,
  };
}
