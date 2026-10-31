"use client";

import { useInvoiceDownload } from "@/features/invoices/hooks/use-invoice-download";
import { fetchInvoiceStatement } from "@/features/invoices/lib/fetch-invoice-statement";
import { invoiceStatementFileName } from "@/features/invoices/lib/invoice-statement-csv";

/** The Download statement action (VI-F09-S05). */
export const useInvoiceStatement = (invoiceId: string, invoiceNumber: string) =>
  useInvoiceDownload(() => fetchInvoiceStatement(invoiceId), invoiceStatementFileName(invoiceNumber));
