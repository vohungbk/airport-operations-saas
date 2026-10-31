import { fetchInvoiceFile, type InvoiceFileResult } from "@/features/invoices/lib/fetch-invoice-file";

export type InvoiceStatementResult = InvoiceFileResult;

/** Asks the route for the booking statement of an invoice (VI-F09-S05). */
export const fetchInvoiceStatement = (invoiceId: string, fetcher: typeof fetch = fetch) =>
  fetchInvoiceFile(
    `/api/invoices/${encodeURIComponent(invoiceId)}/statement`,
    "Could not build the statement. Please try again.",
    fetcher,
  );
