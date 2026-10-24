import { PageNotFound } from "@/components/shared/page-state";

/**
 * Shown for an unknown booking and for one RLS hides (another partner's): the two look the same on
 * purpose, so a partner learns nothing about bookings that are not theirs.
 */
export default function BookingRevenueNotFound() {
  return (
    <PageNotFound
      title="Booking not found"
      description="This booking does not exist or you cannot see its revenue."
      backHref="/bookings"
      backLabel="Back to bookings"
    />
  );
}
