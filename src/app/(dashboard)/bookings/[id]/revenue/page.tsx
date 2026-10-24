import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { FINANCE_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { BookingRevenueBreakdown } from "@/features/bookings/components/booking-revenue-breakdown";
import { buildBookingRevenue } from "@/features/bookings/lib/booking-revenue";
import { getBookingRevenue } from "@/features/bookings/lib/get-booking-revenue";

interface BookingRevenuePageProps {
  params: Promise<{ id: string }>;
}

/**
 * VI-F04-S08: how the revenue of a booking was calculated. A manager or a partner user may open
 * it (`finance:view` or `finance:view_own_partner`), checked here before anything is read; RLS then
 * gives a partner user only the bookings of its own partner. A booking that is unknown, malformed
 * or hidden by RLS is the same not-found page. Read only.
 */
export default async function BookingRevenuePage({ params }: BookingRevenuePageProps) {
  await requireAnyPermission(FINANCE_ACCESS_PERMISSIONS);

  const { id } = await params;
  const booking = await getBookingRevenue(id);

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

      <BookingRevenueBreakdown view={buildBookingRevenue(booking)} />
    </div>
  );
}
