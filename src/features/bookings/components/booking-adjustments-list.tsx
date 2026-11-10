import type { ReactNode } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatOverviewDateTime } from "@/features/bookings/lib/booking-overview";
import { REVENUE_CURRENCY, formatMoney, formatUsd, round2 } from "@/features/bookings/lib/booking-revenue";
import type { BookingAdjustmentRow } from "@/features/bookings/lib/get-booking-adjustments";
import { ADJUSTMENT_GROUP_LABEL } from "@/features/bookings/schemas/adjustment.schema";

interface BookingAdjustmentsListProps {
  adjustments: BookingAdjustmentRow[];
  /** The time zone of the booking's airport; every date is shown in it. */
  timeZone: string;
  /** "Add adjustment", for a role that may add one. */
  action?: ReactNode;
}

/**
 * VI-F04 S2/S3 (R16) / UI-F06-T04: the adjustments recorded on a booking, newest first, read only. History is
 * never deleted. Shown to the operations team only: the reason is an internal note. Every adjustment takes
 * revenue off, so its amount is negative, in the danger color, with the type as its text label.
 */
export function BookingAdjustmentsList({ adjustments, timeZone, action }: BookingAdjustmentsListProps) {
  const net = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);

  return (
    <section aria-labelledby="adjustments-heading" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="adjustments-heading" className="text-base font-semibold text-foreground">
          Adjustments · Net {formatUsd(round2(-net))}
        </h2>
        {action}
      </div>

      {adjustments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          No adjustment has been recorded on this booking.
        </p>
      ) : (
        <Table stacked>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount ({REVENUE_CURRENCY})</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Created by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments.map((adjustment) => (
              <TableRow key={adjustment.id}>
                <TableCell data-label="Date" className="whitespace-normal">
                  {formatOverviewDateTime(adjustment.created_at, timeZone)}
                  {adjustment.after_settlement && (
                    <span className="block text-xs text-muted-foreground">Carried to the next settlement</span>
                  )}
                </TableCell>
                <TableCell data-label="Type">{ADJUSTMENT_GROUP_LABEL[adjustment.type]}</TableCell>
                <TableCell data-label="Amount" className="text-right tabular-nums text-danger-fg">
                  {formatMoney(-adjustment.amount)}
                </TableCell>
                <TableCell data-label="Reason" className="whitespace-normal break-words">
                  {adjustment.reason}
                </TableCell>
                <TableCell data-label="Created by">{adjustment.creator?.full_name ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
