import { formatBookingDate } from "@/features/bookings/lib/booking-time";
import type { RecordedChainStep } from "@/features/return-queue/lib/return-chain";

/** The private bucket of the chain step photos (migration 20261219090000). */
export const RETURN_CHAIN_PHOTO_BUCKET = "return-chain-photos";

/** `<booking id>/<step>/<photo id>.jpg`: the folder complete_return_chain_step() accepts. Pure. */
export function chainStepPhotoPath(
  bookingId: string,
  step: RecordedChainStep,
  photoId: string,
  contentType: string,
): string {
  const extension = contentType === "image/png" ? "png" : "jpg";

  return `${bookingId}/${step}/${photoId}.${extension}`;
}

/** `SEAT-0001 · DXB · 04 Nov 2026`: the line under the photo heading. Pure. */
export function chainStepPhotoStamp(
  seat: string,
  airportCode: string | null,
  now: Date,
  timeZone: string,
): string {
  return [seat, airportCode, formatBookingDate(now.toISOString(), timeZone)].filter(Boolean).join(" · ");
}
