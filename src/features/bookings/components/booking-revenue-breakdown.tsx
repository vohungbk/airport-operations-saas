import { Alert, AlertDescription } from "@/components/ui/alert";
import type { BookingRevenueView } from "@/features/bookings/lib/booking-revenue";

interface BookingRevenueBreakdownProps {
  view: BookingRevenueView;
}

/**
 * VI-F04 S2: how the revenue of a booking was calculated. Read only: the figures are the ones the
 * database stored when the rental was completed, cancelled or marked as a no-show.
 */
export function BookingRevenueBreakdown({ view }: BookingRevenueBreakdownProps) {
  if (view.state === "empty") {
    return (
      <div className="rounded-lg border border-dashed border-border p-4">
        <p className="text-sm font-medium text-foreground">No revenue yet</p>
        <p className="mt-1 text-sm text-muted-foreground">{view.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {view.notices.map((notice) => (
        <Alert key={notice}>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ))}
      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
        {view.lines.map((line) => (
          <div key={line.label}>
            <dt className="text-sm text-muted-foreground">{line.label}</dt>
            <dd className="mt-1 text-sm text-foreground">{line.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
