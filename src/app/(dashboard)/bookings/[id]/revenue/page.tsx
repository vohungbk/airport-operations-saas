import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  FINANCE_ACCESS_PERMISSIONS,
  FINANCE_ADJUSTMENT_PERMISSIONS,
  hasAnyPermission,
} from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { BookingAdjustmentsList } from "@/features/bookings/components/booking-adjustments-list";
import { BookingRevenueBreakdown } from "@/features/bookings/components/booking-revenue-breakdown";
import { canAddAdjustment } from "@/features/bookings/lib/booking-adjustment";
import { buildBookingRevenue } from "@/features/bookings/lib/booking-revenue";
import { getBookingAdjustments } from "@/features/bookings/lib/get-booking-adjustments";
import { getBookingRevenue } from "@/features/bookings/lib/get-booking-revenue";

interface BookingRevenuePageProps {
  params: Promise<{ id: string }>;
}

/**
 * VI-F04-S08: how the revenue of a booking was calculated. A manager or a partner user may open
 * it (`finance:view` or `finance:view_own_partner`), checked here before anything is read; RLS then
 * gives a partner user only the bookings of its own partner. A booking that is unknown, malformed
 * or hidden by RLS is the same not-found page. Read only. "Add adjustment" (VI-F04-S09) is offered
 * only to a role that may add one, and only for a completed rental with revenue to correct.
 */
export default async function BookingRevenuePage({ params }: BookingRevenuePageProps) {
  const user = await requireAnyPermission(FINANCE_ACCESS_PERMISSIONS);

  const { id } = await params;
  const mayAdjust = hasAnyPermission(user.role, FINANCE_ADJUSTMENT_PERMISSIONS);
  // The list of adjustments is for the operations team; a partner user sees the total in the figures.
  const [booking, adjustments] = await Promise.all([
    getBookingRevenue(id),
    mayAdjust ? getBookingAdjustments(id) : Promise.resolve(null),
  ]);

  if (!booking) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Booking revenue</h1>
          <p className="text-sm text-muted-foreground">{booking.booking_number}</p>
        </div>
        <Link href={`/bookings/${booking.id}`} className={buttonVariants({ variant: "outline" })}>
          Back to booking
        </Link>
      </div>

      <BookingRevenueBreakdown
        view={buildBookingRevenue(booking)}
        adjustmentHref={
          mayAdjust && canAddAdjustment(booking)
            ? `/bookings/${booking.id}/adjustment`
            : undefined
        }
      />

      {adjustments && <BookingAdjustmentsList adjustments={adjustments} />}
    </div>
  );
}
