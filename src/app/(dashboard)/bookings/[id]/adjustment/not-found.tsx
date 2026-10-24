import { PageNotFound } from "@/components/shared/page-state";

/** Shown for an unknown booking and for one RLS hides: the two look the same on purpose. */
export default function AdjustmentNotFound() {
  return (
    <PageNotFound
      title="Booking not found"
      description="This booking does not exist or you cannot see it."
      backHref="/bookings"
      backLabel="Back to bookings"
    />
  );
}
