"use client";

import { FileSpreadsheet } from "lucide-react";

import { DownloadActionButton } from "@/features/invoices/components/download-action-button";
import { useInvoiceStatement } from "@/features/invoices/hooks/use-invoice-statement";

interface DownloadStatementButtonProps {
  invoiceId: string;
  invoiceNumber: string;
}

/** The Download statement button of the invoice detail (VI-F09-S05). */
export function DownloadStatementButton({ invoiceId, invoiceNumber }: DownloadStatementButtonProps) {
  return (
    <DownloadActionButton
      icon={FileSpreadsheet}
      label="Download statement"
      pendingLabel="Preparing statement…"
      errorTitle="Could not download the statement"
      variant="outline"
      {...useInvoiceStatement(invoiceId, invoiceNumber)}
    />
  );
}
