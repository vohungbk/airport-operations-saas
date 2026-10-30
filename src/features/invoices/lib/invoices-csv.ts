import {
  INVOICE_STATUS_LABEL,
  type InvoiceListRow,
} from "@/features/invoices/lib/invoice-list";

/** Excel reads a file as UTF-8, and so keeps a name with an accent, only when it starts with this mark. */
export const CSV_BOM = "﻿";

/** A line of a CSV file ends with CRLF (RFC 4180). */
const EOL = "\r\n";

/**
 * A text cell. A cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return would be taken for a
 * formula by a spreadsheet, so it is given a leading `'`; a cell with a comma, a quote or a line break is
 * quoted, with the quotes inside doubled. Numbers and dates are written by `plainCell`, not here.
 */
export function textCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** `2400` -> `2400.00`: a number a spreadsheet can add up, with no currency and no thousands mark. */
export function plainAmount(value: number): string {
  const cents = Math.round(Math.abs(value) * 100);
  const text = `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;

  return value < 0 && cents !== 0 ? `-${text}` : text;
}

/** `2026-09-01` -> `2026-09`, or an empty cell for an invoice with no settlement. */
const periodCell = (periodStart: string | null) => (periodStart ? periodStart.slice(0, 7) : "");

/**
 * Pure (VI-F09-S02). The invoice list as a CSV file, in machine-readable form: the month as `YYYY-MM`, the
 * dates as `YYYY-MM-DD`, the amount as a plain number. The Partner column is for the operations team, as in
 * the table. An empty list gives the header line alone.
 */
export function buildInvoicesCsv(rows: readonly InvoiceListRow[], includePartner: boolean): string {
  const header = [
    "Invoice number",
    ...(includePartner ? ["Partner"] : []),
    "Period",
    "Amount (USD)",
    "Due date",
    "Payment status",
  ];

  const lines = rows.map((row) =>
    [
      textCell(row.invoice_number),
      ...(includePartner ? [textCell(row.partner?.name ?? "")] : []),
      periodCell(row.period_start),
      plainAmount(row.total),
      row.due_date,
      INVOICE_STATUS_LABEL[row.status],
    ].join(","),
  );

  return CSV_BOM + [header.join(","), ...lines].join(EOL) + EOL;
}

/** `invoices-2026-10-30.csv`. */
export const invoicesCsvFileName = (today: string) => `invoices-${today}.csv`;
