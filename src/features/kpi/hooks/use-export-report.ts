"use client";

import { useState } from "react";

import { saveDownload } from "@/features/invoices/lib/save-download";
import { requestReport } from "@/features/kpi/lib/download-report";

/** The state of the Export report button (VI-F05-T03): busy while the file is made, and the error to show when it fails. */
export function useExportReport(href: string) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportReport() {
    setPending(true);
    setError(null);

    const result = await requestReport(href);
    if (result.ok) saveDownload(result.blob, result.file_name);
    else setError(result.message);

    setPending(false);
  }

  return { pending, error, exportReport };
}
