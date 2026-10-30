import Link from "next/link";

import {
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { InvoiceRowMenu } from "@/features/invoices/components/invoice-row-menu";
import { buildInvoicesHref } from "@/features/invoices/lib/build-invoices-href";
import type { InvoiceRowView } from "@/features/invoices/lib/invoice-list";
import type { InvoicesSortColumn, ResolvedInvoicesQuery } from "@/features/invoices/schemas/invoices-query.schema";

interface InvoicesTableProps {
  rows: InvoiceRowView[];
  query: ResolvedInvoicesQuery;
  /** The Partner column is for the operations team: a partner user sees only its own invoices. */
  showPartner: boolean;
}

function SortHeader({ query, column, label, className }: { query: ResolvedInvoicesQuery; column: InvoicesSortColumn; label: string; className?: string }) {
  const isActive = query.sort === column;

  return (
    <SortableTableHead
      href={buildInvoicesHref(query, { sort: column, order: isActive && query.order === "asc" ? "desc" : "asc" })}
      label={label}
      direction={isActive ? query.order : null}
      idleIcon
      className={className}
    />
  );
}

/**
 * Server Component. Read only: the invoice number and the row menu open the invoice, nothing here changes
 * one. The rows come ready from `buildInvoiceRows`.
 */
export function InvoicesTable({ rows, query, showPartner }: InvoicesTableProps) {
  return (
    <div className="min-w-0 sm:overflow-hidden sm:rounded-lg sm:border sm:bg-card">
      <Table stacked>
        <TableHeader className="sm:bg-muted [&_th]:h-13 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase [&_th_a]:text-[11px] [&_th_a]:font-semibold">
          <TableRow>
            <SortHeader query={query} column="invoice_number" label="Invoice number" />
            {showPartner && <TableHead>Partner</TableHead>}
            <SortHeader query={query} column="period" label="Period" />
            <SortHeader query={query} column="amount" label="Amount (USD)" className="sm:text-right" />
            <SortHeader query={query} column="due_date" label="Due date" />
            <TableHead>Payment status</TableHead>
            <TableHead>Menu</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="sm:[&_tr]:border-0">
          {rows.map((row) => (
            <TableRow key={row.id} className="sm:h-13">
              <TableCell data-label="Invoice number" className="font-mono text-[13px]">
                <Link href={`/invoices/${row.id}`} className="text-primary underline-offset-4 hover:underline">
                  {row.invoice_number}
                </Link>
              </TableCell>
              {showPartner && <TableCell data-label="Partner">{row.partner ?? "—"}</TableCell>}
              <TableCell data-label="Period">{row.period}</TableCell>
              <TableCell data-label="Amount (USD)" className="font-mono text-[13px] tabular-nums sm:text-right">
                {row.amount}
              </TableCell>
              <TableCell data-label="Due date">
                {row.due_date}
                {row.overdue_note && <span className="block text-xs text-danger-fg">{row.overdue_note}</span>}
              </TableCell>
              <TableCell data-label="Payment status">
                <StatusBadge domain="invoice" value={row.status} />
              </TableCell>
              <TableCell data-label="Menu">
                <InvoiceRowMenu id={row.id} invoice_number={row.invoice_number} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
