"use client";

import { useState, useTransition } from "react";

import { fetchInvoicePdf } from "@/features/invoices/lib/fetch-invoice-pdf";
import { invoicePdfFileName } from "@/features/invoices/lib/invoice-pdf-file-name";

/** Hands the file to the browser as a download, then lets go of it. */
function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * The Download PDF action (VI-F09-S04). It asks the route for the PDF and saves it. A failure leaves an error to
 * show and nothing else, and the same action can be run again (Retry).
 */
export function useInvoicePdf(invoiceId: string, invoiceNumber: string) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const download = () => {
    setError(null);
    startTransition(async () => {
      const result = await fetchInvoicePdf(invoiceId);

      if (result.ok) {
        save(result.blob, invoicePdfFileName(invoiceNumber));
      } else {
        setError(result.message);
      }
    });
  };

  return { download, isPending, error };
}
