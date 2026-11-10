import { Alert, AlertDescription } from "@/components/ui/alert";
import { REVENUE_CURRENCY, type BookingRevenueView, type RevenueLine } from "@/features/bookings/lib/booking-revenue";
import { cn } from "@/lib/utils";

interface BookingRevenueBreakdownProps {
  view: BookingRevenueView;
}

function Column({ lines }: { lines: RevenueLine[] }) {
  return (
    <dl className="flex min-w-0 flex-col gap-3">
      {lines.map((line) => (
        <div key={line.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 text-sm">
          <dt className="text-muted-foreground">{line.label}</dt>
          <dd className={cn("text-right break-words tabular-nums", line.negative ? "text-danger-fg" : "text-foreground")}>
            {line.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * VI-F04 S2 / UI-F06-T04: how the revenue of a booking was calculated, as the card "Revenue breakdown". Read
 * only: the figures are the ones the database stored when the rental was completed, cancelled or marked as a
 * no-show, so they are verified amounts.
 */
export function BookingRevenueBreakdown({ view }: BookingRevenueBreakdownProps) {
  if (view.state === "empty") {
    return (
      <div className="rounded-xl border border-dashed border-border p-5">
        <p className="text-sm font-medium text-foreground">No revenue yet</p>
        <p className="mt-1 text-sm text-muted-foreground">{view.message}</p>
      </div>
    );
  }

  const { card, notices } = view;

  return (
    <section aria-labelledby="revenue-breakdown-heading" className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <h2 id="revenue-breakdown-heading" className="text-base font-semibold text-foreground">
        Revenue breakdown · Verified amounts · {REVENUE_CURRENCY}
      </h2>
      {notices.map((notice) => (
        <Alert key={notice}>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ))}
      <div className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-2">
        <Column lines={card.left} />
        <Column lines={card.right} />
      </div>
      {card.formula.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-4 text-sm text-muted-foreground">
          {card.formula.map((text) => (
            <p key={text} className="break-words">
              {text}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
