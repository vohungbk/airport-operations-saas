import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OverviewTile } from "@/features/dashboard/components/overview-tile";
import { DownloadPdfButton } from "@/features/invoices/components/download-pdf-button";
import { DownloadStatementButton } from "@/features/invoices/components/download-statement-button";
import { PaymentStatus } from "@/features/invoices/components/payment-status";
import type { InvoiceDetailView } from "@/features/invoices/lib/invoice-detail";
import { cn } from "@/lib/utils";

interface InvoiceDetailProps {
  view: InvoiceDetailView;
  invoiceId: string;
}

/**
 * The invoice detail as the design draws it (VI-F09-S03): the number and the status, who, which month and
 * when, three cards (the amount, the due date, the VAT), the lines with the subtotal, the VAT and the total,
 * how the total is made up, and where the invoice is on its payment status. It downloads as a PDF (S04) and its
 * booking statement as a CSV (S05); the update of the status and the history of the design are other tickets.
 */
export function InvoiceDetail({ view, invoiceId }: InvoiceDetailProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-mono text-3xl font-semibold tracking-tight break-all text-foreground">
            {view.invoice_number}
          </h1>
          <StatusBadge domain="invoice" value={view.status} />
        </div>
        <p className="text-sm text-muted-foreground">{view.meta}</p>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <DownloadPdfButton invoiceId={invoiceId} invoiceNumber={view.invoice_number} />
        <DownloadStatementButton invoiceId={invoiceId} invoiceNumber={view.invoice_number} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {view.cards.map((card) => (
          <OverviewTile key={card.label} label={card.label} value={card.value} caption={card.caption} />
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Invoice lines</h2>
          {!view.has_lines ? (
            <p className="text-sm text-muted-foreground">No lines recorded for this invoice.</p>
          ) : (
            <div className="min-w-0 sm:overflow-hidden sm:rounded-lg sm:border sm:bg-card">
              <Table stacked>
                <TableHeader className="sm:bg-muted [&_th]:h-11 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-foreground">
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="sm:text-right">Amount (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.lines.map((line) => (
                    <TableRow key={line.description} className={cn(line.is_total && "font-semibold")}>
                      <TableCell data-label="Description">{line.description}</TableCell>
                      <TableCell
                        data-label="Amount (USD)"
                        className={cn("font-mono text-[13px] tabular-nums sm:text-right", line.negative && "text-danger-fg")}
                      >
                        {line.amount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {view.explanation && <p className="text-sm text-muted-foreground">{view.explanation}</p>}

      <PaymentStatus steps={view.steps} sideStates={view.side_states} current={view.current} />
    </div>
  );
}
