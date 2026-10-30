import { Card, CardContent } from "@/components/ui/card";
import type { InvoiceDetailView } from "@/features/invoices/lib/invoice-detail";
import { cn } from "@/lib/utils";

interface PaymentStatusProps {
  steps: InvoiceDetailView["steps"];
  sideStates: InvoiceDetailView["side_states"];
  current: string;
}

/**
 * Where the invoice is on Draft, Issued, Paid, and which side state (overdue or void) it is in. Read only: the
 * update of the status is another ticket, and who made the last change is in the history of the finance data,
 * which a partner user cannot read.
 */
export function PaymentStatus({ steps, sideStates, current }: PaymentStatusProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Payment status</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ol className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {steps.map((step, index) => (
              <li
                key={step.label}
                aria-current={step.state === "current" ? "step" : undefined}
                className={cn("flex items-center gap-2", step.state === "upcoming" ? "text-muted-foreground" : "text-foreground")}
              >
                {index > 0 && <span aria-hidden="true">→</span>}
                <span>
                  {index + 1} {step.label}
                </span>
                {step.state === "current" && <span className="sr-only">(current)</span>}
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            Side states:{" "}
            {sideStates.map((side, index) => (
              <span key={side.label} className={cn(side.active && "font-semibold text-foreground")}>
                {index > 0 && " / "}
                {side.label}
              </span>
            ))}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{current}</p>
      </CardContent>
    </Card>
  );
}
