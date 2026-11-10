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

/** The reason a file is rejected, or `null` when it may be added. Nothing is stored for a rejected file. */
export function validatePhotoFile(file: { type: string; size: number; name: string }): string | null {
  if (!(PHOTO_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name} is not a JPG or PNG photo.`;
  }
  if (file.size > PHOTO_MAX_BYTES) return `${file.name} is larger than 10 MB.`;
  return null;
}

export function filterBookingPhotos(photos: readonly BookingPhoto[], filter: BookingPhotoFilter): BookingPhoto[] {
  return filter === "all" ? [...photos] : photos.filter((photo) => photo.type === filter);
}

/** The photo after or before the open one, going round at the ends. */
export function stepPhotoIndex(index: number, count: number, direction: 1 | -1): number {
  return count === 0 ? 0 : (index + direction + count) % count;
}
