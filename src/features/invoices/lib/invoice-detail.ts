import {
  INVOICE_STATUS_LABEL,
  formatInvoiceAmount,
  formatInvoiceDate,
  formatShortMonth,
  overdueDays,
  type InvoiceStatus,
} from "@/features/invoices/lib/invoice-list";

export interface InvoiceDetailRow {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  vat: number;
  total: number;
  status: InvoiceStatus;
  partner: { name: string; code: string } | null;
  period_start: string | null;
}

export interface InvoiceDetailView {
  invoice_number: string;
  status: InvoiceStatus;
  lines: Array<{ label: string; value: string }>;
}

const NONE = "—";

/** Pure. The summary of an invoice as the screen writes it, from the figures the database stored. */
export function buildInvoiceDetail(row: InvoiceDetailRow, today: string): InvoiceDetailView {
  const late = row.status === "overdue" ? overdueDays(row.due_date, today) : null;

  return {
    invoice_number: row.invoice_number,
    status: row.status,
    lines: [
      { label: "Partner", value: row.partner ? `${row.partner.name} (${row.partner.code})` : NONE },
      { label: "Period", value: row.period_start ? formatShortMonth(row.period_start) : NONE },
      { label: "Issued", value: formatInvoiceDate(row.issue_date) },
      { label: "Subtotal", value: formatInvoiceAmount(row.subtotal) },
      { label: "VAT", value: formatInvoiceAmount(row.vat) },
      { label: "Total", value: formatInvoiceAmount(row.total) },
      {
        label: "Due date",
        value: late === null ? formatInvoiceDate(row.due_date) : `${formatInvoiceDate(row.due_date)} (overdue by ${late} ${late === 1 ? "day" : "days"})`,
      },
      { label: "Payment status", value: INVOICE_STATUS_LABEL[row.status] },
    ],
  };
}
