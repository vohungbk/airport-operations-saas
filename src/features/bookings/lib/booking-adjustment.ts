import type { BookingRevenueRow } from "@/features/bookings/lib/get-booking-revenue";

/**
 * Pure (VI-F04-S09). An adjustment, a refund or a chargeback corrects revenue that exists, so only
 * a completed rental whose gross revenue was calculated can have one: a booking that is not
 * completed, cancelled, a no-show, or flagged (no duration) has nothing to correct.
 */
export function canAddAdjustment(row: BookingRevenueRow): boolean {
  return (
    (row.revenue_case === "standard" || row.revenue_case === "early_return") &&
    row.revenue_flag !== "invalid_duration" &&
    row.gross_revenue !== null
  );
}
