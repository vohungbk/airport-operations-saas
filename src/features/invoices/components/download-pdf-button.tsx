"use client";

import { Download } from "lucide-react";

import { DownloadActionButton } from "@/features/invoices/components/download-action-button";
import { useInvoicePdf } from "@/features/invoices/hooks/use-invoice-pdf";

interface DownloadPdfButtonProps {
  invoiceId: string;
  invoiceNumber: string;
}

/** The Download PDF button of the invoice detail. */
export function DownloadPdfButton({ invoiceId, invoiceNumber }: DownloadPdfButtonProps) {
  return (
    <DownloadActionButton
      icon={Download}
      label="Download PDF"
      pendingLabel="Preparing PDF…"
      errorTitle="Could not download the PDF"
      {...useInvoicePdf(invoiceId, invoiceNumber)}
    />
  );
}
