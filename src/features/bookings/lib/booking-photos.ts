import { PHOTO_ACCEPTED_TYPES, PHOTO_MAX_BYTES } from "@/lib/field/photo-upload";

/** The photos of a booking (UI-F06-T06): the filter chips, the file rules and the filter itself. Pure logic. */

export const BOOKING_PHOTO_TYPES = ["installation", "return", "incident"] as const;

export type BookingPhotoType = (typeof BOOKING_PHOTO_TYPES)[number];

export const BOOKING_PHOTO_TYPE_LABEL: Record<BookingPhotoType, string> = {
  installation: "Installation",
  return: "Return",
  incident: "Incident",
};

/** The filter chips of the Photos tab, in the order of the design. */
export const BOOKING_PHOTO_FILTERS = [
  { value: "all", label: "All" },
  ...BOOKING_PHOTO_TYPES.map((value) => ({ value, label: BOOKING_PHOTO_TYPE_LABEL[value] })),
] as const;

export type BookingPhotoFilter = (typeof BOOKING_PHOTO_FILTERS)[number]["value"];

export interface BookingPhoto {
  id: string;
  /** A signed address of the photo (the photos are private). */
  url: string;
  caption: string | null;
  type: BookingPhotoType;
  uploader_name: string | null;
  taken_at: string | null;
}

/** The photos of a booking are at most 2 MB each (FO-F06-S01); other photo screens keep their own limit. */
export const BOOKING_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const BOOKING_PHOTO_DROP_HINT = "JPG or PNG, up to 2 MB";
export const BOOKING_PHOTO_RULE_HINT = "JPG or PNG · Up to 2 MB per photo";
export const BOOKING_PHOTO_CAPTION_MAX_LENGTH = 200;

/** The private bucket of the booking photos (migration 20261227090000). */
export const BOOKING_PHOTO_BUCKET = "booking-photos";

/** The signed addresses of the private photos are short-lived (FO-F06-S04, R7): they stay valid for five minutes. */
export const BOOKING_PHOTO_SIGNED_URL_SECONDS = 5 * 60;

/** The caption of a photo that has none typed: its file name without the extension, cut to the caption limit. Pure. */
export function captionFromFileName(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, "").trim().slice(0, BOOKING_PHOTO_CAPTION_MAX_LENGTH);
}

/** `<booking id>/<type>/<photo id>.jpg`: the folder record_booking_photo() accepts. Pure. */
export function bookingPhotoPath(bookingId: string, type: BookingPhotoType, photoId: string, contentType: string): string {
  return `${bookingId}/${type}/${photoId}.${contentType === "image/png" ? "png" : "jpg"}`;
}

/** The reason a file is rejected, or `null` when it may be added. Nothing is stored for a rejected file. */
export function validatePhotoFile(
  file: { type: string; size: number; name: string },
  maxBytes: number = PHOTO_MAX_BYTES,
): string | null {
  if (!(PHOTO_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name} is not a JPG or PNG photo.`;
  }
  if (file.size > maxBytes) return `${file.name} is larger than ${Math.round(maxBytes / (1024 * 1024))} MB.`;
  return null;
}

export function filterBookingPhotos(photos: readonly BookingPhoto[], filter: BookingPhotoFilter): BookingPhoto[] {
  return filter === "all" ? [...photos] : photos.filter((photo) => photo.type === filter);
}

/** The photo after or before the open one, going round at the ends. */
export function stepPhotoIndex(index: number, count: number, direction: 1 | -1): number {
  return count === 0 ? 0 : (index + direction + count) % count;
}

/** `6 photos`, `1 photo`: the count line of the Photo viewer. */
export function photoCountLabel(count: number): string {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}
