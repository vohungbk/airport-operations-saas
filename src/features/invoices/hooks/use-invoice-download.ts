"use client";

import { useState, useTransition } from "react";

import type { InvoiceFileResult } from "@/features/invoices/lib/fetch-invoice-file";
import { saveDownload } from "@/features/invoices/lib/save-download";

/**
 * A download of a file of an invoice (VI-F09-S04, S05). It asks for the file and saves it. A failure leaves an error
 * to show and nothing else, and the same action can be run again (Retry).
 */
export function useInvoiceDownload(request: () => Promise<InvoiceFileResult>, fileName: string) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const download = () => {
    setError(null);
    startTransition(async () => {
      const result = await request();

      if (result.ok) {
        saveDownload(result.blob, fileName);
      } else {
        setError(result.message);
      }
    });
  };

  return { download, isPending, error };
}
