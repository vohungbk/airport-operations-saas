import { fetchInvoiceFile, type InvoiceFileResult } from "@/features/invoices/lib/fetch-invoice-file";

export type InvoicePdfResult = InvoiceFileResult;

/** Asks the route for the PDF of an invoice (VI-F09-S04). */
export const fetchInvoicePdf = (invoiceId: string, fetcher: typeof fetch = fetch) =>
  fetchInvoiceFile(`/api/invoices/${encodeURIComponent(invoiceId)}/pdf`, "Could not build the PDF. Please try again.", fetcher);
