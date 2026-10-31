import { safeInvoiceFileStem } from "@/features/invoices/lib/invoice-pdf-file-name";
import { CSV_BOM, plainAmount, textCell } from "@/features/invoices/lib/invoices-csv";

/** A completed rental of the statement, as the database stored it. */
export interface StatementBooking {
  booking_number: string;
  revenue_case: string | null;
  paid_days: number;
  gross_revenue: number | null;
  partner_share: number | null;
  platform_share: number | null;
  launch_credit: number;
  /** Zero or negative: what refunds, chargebacks and adjustments took off the gross revenue. */
  adjustments_total: number;
  return_at: string;
  actual_return_at: string | null;
}

const EOL = "\r\n";

const HEADER = [
  "Booking number",
  "Returned",
  "Case",
  "Paid days",
  "Gross revenue (USD)",
  "Partner share (USD)",
  "Platform share (USD)",
  "Launch credit (USD)",
  "Adjustments (USD)",
];

const CASE_LABEL: Record<string, string> = { standard: "Standard", early_return: "Early return" };

/** The day the rental was really returned (UTC), or the day it was due when there is no return time. */
const returnedDay = (row: StatementBooking) => new Date(row.actual_return_at ?? row.return_at).toISOString().slice(0, 10);

const amountCell = (value: number | null) => (value === null ? "" : plainAmount(value));

/** The start of the file: the UTF-8 mark, so Excel keeps accents, and the header line. */
export const statementCsvStart = () => CSV_BOM + HEADER.join(",") + EOL;

/**
 * Pure (VI-F09-S05). Some bookings of the statement as CSV lines, in machine-readable form: the day as
 * `YYYY-MM-DD`, the amounts as plain numbers. Written batch by batch so a long statement is streamed.
 */
export function statementCsvLines(rows: readonly StatementBooking[]): string {
  return rows
    .map(
      (row) =>
        [
          textCell(row.booking_number),
          returnedDay(row),
          CASE_LABEL[row.revenue_case ?? ""] ?? "",
          String(row.paid_days),
          amountCell(row.gross_revenue),
          amountCell(row.partner_share),
          amountCell(row.platform_share),
          amountCell(row.launch_credit),
          amountCell(row.adjustments_total),
        ].join(",") + EOL,
    )
    .join("");
}

/** `INV-2026-000045-statement.csv`: the number of the invoice, with anything unsafe made safe. */
export const invoiceStatementFileName = (invoiceNumber: string) => `${safeInvoiceFileStem(invoiceNumber)}-statement.csv`;
