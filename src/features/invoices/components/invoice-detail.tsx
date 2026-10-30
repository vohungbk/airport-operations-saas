import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { InvoiceDetailView } from "@/features/invoices/lib/invoice-detail";

interface InvoiceDetailProps {
  view: InvoiceDetailView;
}

/** The summary of one invoice. Read only; the lines, the PDF and the statement are other tickets. */
export function InvoiceDetail({ view }: InvoiceDetailProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-base font-semibold text-foreground">{view.invoice_number}</h2>
          <StatusBadge domain="invoice" value={view.status} />
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {view.lines.map((line) => (
            <div key={line.label} className="flex min-w-0 gap-3">
              <dt className="min-w-0 flex-1 text-muted-foreground">{line.label}</dt>
              <dd className="min-w-0 flex-1 text-right break-words text-foreground">{line.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
