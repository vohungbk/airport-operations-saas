import { AddAdjustmentDialog } from "@/features/bookings/components/add-adjustment-dialog";
import { BookingAdjustmentsList } from "@/features/bookings/components/booking-adjustments-list";
import { BookingRevenueBreakdown } from "@/features/bookings/components/booking-revenue-breakdown";
import { buildBookingRevenue } from "@/features/bookings/lib/booking-revenue";
import type { BookingAdjustmentRow } from "@/features/bookings/lib/get-booking-adjustments";
import type { BookingRevenueRow } from "@/features/bookings/lib/get-booking-revenue";

export interface BookingRevenueData {
  row: BookingRevenueRow;
  /** The adjustments of the booking; `null` for a partner user, who sees the shares and the total only. */
  adjustments: BookingAdjustmentRow[] | null;
  /** The role may add an adjustment and the booking can have one (completed, with revenue). */
  canAdjust: boolean;
}

interface BookingRevenueTabProps {
  data: BookingRevenueData;
  timeZone: string;
}

/**
 * The Revenue tab of a booking (UI-F06-T04): the breakdown card, then the adjustments with "Add adjustment".
 * A partner user gets the card without the platform lines and no adjustments.
 */
export function BookingRevenueTab({ data, timeZone }: BookingRevenueTabProps) {
  const { row, adjustments, canAdjust } = data;
  const view = buildBookingRevenue(row, { adjustments: adjustments ?? [], internal: adjustments !== null });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BookingRevenueBreakdown view={view} />
      {adjustments && (
        <BookingAdjustmentsList
          adjustments={adjustments}
          timeZone={timeZone}
          action={
            canAdjust && row.gross_revenue !== null ? (
              <AddAdjustmentDialog bookingId={row.id} bookingNumber={row.booking_number} maxAmount={row.gross_revenue} />
            ) : undefined
          }
        />
      )}
    </div>
  );
}
