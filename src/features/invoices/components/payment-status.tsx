import { Card, CardContent } from "@/components/ui/card";
import {
  UpdateInvoiceStatusButton,
  type UpdateInvoiceStatusButtonProps,
} from "@/features/invoices/components/update-invoice-status-button";
import type { InvoiceDetailView } from "@/features/invoices/lib/invoice-detail";
import { cn } from "@/lib/utils";

interface PaymentStatusProps {
  steps: InvoiceDetailView["steps"];
  sideStates: InvoiceDetailView["side_states"];
  current: string;
  /** Only for an admin looking at an invoice that can still move (VI-F09-S08): it shows Update status. */
  update?: UpdateInvoiceStatusButtonProps;
}

/**
 * Where the invoice is on Draft, Issued, Paid, and which side state (overdue or void) it is in. An admin can update
 * the status by hand (VI-F09-S08). Who made the last change is in the history of the finance data, which a partner
 * user cannot read.
 */
export function PaymentStatus({ steps, sideStates, current, update }: PaymentStatusProps) {
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
        {update && <UpdateInvoiceStatusButton {...update} />}
      </CardContent>
    </Card>
  );
}
