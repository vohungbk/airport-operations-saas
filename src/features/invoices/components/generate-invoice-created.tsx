import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { OverviewTile } from "@/features/dashboard/components/overview-tile";
import { formatInvoiceAmount } from "@/features/invoices/lib/invoice-list";
import type { GeneratedInvoice } from "@/features/invoices/lib/invoice-errors";

interface GenerateInvoiceCreatedProps {
  invoice: GeneratedInvoice;
  /** `Emirates Rent A Car / September 2026`: who it is for and which month. */
  subject: string;
}

/** The Success state of the Generate invoice design: the draft that was made, with a way to open it. */
export function GenerateInvoiceCreated({ invoice, subject }: GenerateInvoiceCreatedProps) {
  return (
    <div className="flex flex-col gap-5">
      <Alert>
        <AlertTitle>Draft generated</AlertTitle>
        <AlertDescription>
          New unique draft {invoice.invoice_number} was created for {subject}.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-60">
          <OverviewTile
            label="Draft total"
            value={formatInvoiceAmount(invoice.total)}
            caption="Approved settlement / VAT included"
          />
        </div>
        <StatusBadge domain="invoice" value="draft" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={`/invoices/${invoice.id}`} className={buttonVariants({ className: "min-h-11 px-4" })}>
          View new draft
        </Link>
        <Link href="/invoices" className={buttonVariants({ variant: "outline", className: "min-h-11 px-4" })}>
          Cancel
        </Link>
      </div>
    </div>
  );
}
