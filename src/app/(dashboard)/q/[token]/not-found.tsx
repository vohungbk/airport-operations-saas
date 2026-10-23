import { PageNotFound } from "@/components/shared/page-state";
import { SEAT_QR_PAGE_METADATA } from "@/features/seats/lib/seat-qr-metadata";

export const metadata = SEAT_QR_PAGE_METADATA;

/**
 * Shown for a forged token, an unknown token, and a seat outside the user's scope. The three
 * look the same on purpose, so a scan reveals nothing about seats the user cannot reach.
 */
export default function SeatQrNotFound() {
  return (
    <PageNotFound
      title="Seat not found"
      description="This QR code does not match a seat you can open."
      backHref="/dashboard"
      backLabel="Go to the dashboard"
    />
  );
}
