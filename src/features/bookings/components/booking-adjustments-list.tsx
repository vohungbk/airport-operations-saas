import { formatMoney } from "@/features/bookings/lib/booking-revenue";
import type { BookingAdjustmentRow } from "@/features/bookings/lib/get-booking-adjustments";
import { ADJUSTMENT_TYPE_LABEL } from "@/features/bookings/schemas/adjustment.schema";

interface BookingAdjustmentsListProps {
  adjustments: BookingAdjustmentRow[];
}

/**
 * VI-F04 S2/S3 (R16): the adjustments recorded on a booking, newest first, read only. History is
 * never deleted. Shown to the operations team only: the reason is an internal note.
 */
export function BookingAdjustmentsList({ adjustments }: BookingAdjustmentsListProps) {
  return (
    <section aria-labelledby="adjustments-heading" className="flex flex-col gap-3">
      <h2 id="adjustments-heading" className="text-lg font-medium text-foreground">
        Adjustments recorded
      </h2>

      {adjustments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No adjustment has been recorded on this booking.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {adjustments.map((adjustment) => (
            <li key={adjustment.id} className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-foreground">
                {ADJUSTMENT_TYPE_LABEL[adjustment.type]}: -{formatMoney(adjustment.amount)}
              </p>
              <p className="mt-1 text-sm text-foreground">{adjustment.reason}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {adjustment.created_at.slice(0, 10)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
