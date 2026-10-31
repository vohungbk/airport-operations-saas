"use client";

import { useInvoiceDownload } from "@/features/invoices/hooks/use-invoice-download";
import { fetchInvoicePdf } from "@/features/invoices/lib/fetch-invoice-pdf";
import { invoicePdfFileName } from "@/features/invoices/lib/invoice-pdf-file-name";

/** The Download PDF action (VI-F09-S04). */
export const useInvoicePdf = (invoiceId: string, invoiceNumber: string) =>
  useInvoiceDownload(() => fetchInvoicePdf(invoiceId), invoicePdfFileName(invoiceNumber));
