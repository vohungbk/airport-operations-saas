import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { FINANCE_ADJUSTMENT_PERMISSIONS } from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { canAddAdjustment } from "@/features/bookings/lib/booking-adjustment";
import { formatMoney } from "@/features/bookings/lib/booking-revenue";
import { getBookingRevenue } from "@/features/bookings/lib/get-booking-revenue";

interface AdjustmentPageProps {
  params: Promise<{ id: string }>;
}

/**
 * VI-F04-S09 (NAV-1): the Adjustment form, opened from Booking revenue. An admin or an operations
 * manager may open it (`finance:view`), checked here before anything is read. A booking that is
 * unknown, malformed or hidden by RLS is the same not-found page. Only a completed rental with
 * revenue can have an adjustment; for another booking the page says so. This story opens the
 * screen; the fields and the Save button are VI-F04-S10, so nothing is written from here.
 */
export default async function AdjustmentPage({ params }: AdjustmentPageProps) {
  await requireAnyPermission(FINANCE_ADJUSTMENT_PERMISSIONS);

  const { id } = await params;
  const booking = await getBookingRevenue(id);

  if (!booking) {
    notFound();
  }

  const back = (
    <Link href={`/bookings/${booking.id}/revenue`} className={buttonVariants({ variant: "outline" })}>
      Cancel
    </Link>
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Add adjustment</h1>
        <p className="text-sm text-muted-foreground">{booking.booking_number}</p>
      </div>

      {canAddAdjustment(booking) ? (
        <section aria-labelledby="adjustment-current" className="flex max-w-lg flex-col gap-4">
          <h2 id="adjustment-current" className="text-sm font-medium text-foreground">
            Revenue of this booking now
          </h2>
          <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">Gross revenue</dt>
              <dd className="mt-1 text-sm text-foreground">{formatMoney(booking.gross_revenue)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Partner share</dt>
              <dd className="mt-1 text-sm text-foreground">{formatMoney(booking.partner_share)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Platform share</dt>
              <dd className="mt-1 text-sm text-foreground">{formatMoney(booking.platform_share)}</dd>
            </div>
          </dl>
          <div>{back}</div>
        </section>
      ) : (
        <div className="flex max-w-lg flex-col gap-4">
          <div className="rounded-lg border border-dashed border-border p-4">
            <p className="text-sm font-medium text-foreground">Nothing to adjust</p>
            <p className="mt-1 text-sm text-muted-foreground">
              An adjustment can be added to a completed rental that has revenue. This booking has none.
            </p>
          </div>
          <div>{back}</div>
        </div>
      )}
    </div>
  );
}
