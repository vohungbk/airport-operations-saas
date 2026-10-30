"use client";

import { Download } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useInvoicePdf } from "@/features/invoices/hooks/use-invoice-pdf";

interface DownloadPdfButtonProps {
  invoiceId: string;
  invoiceNumber: string;
}

/** The Download PDF button of the invoice detail. A failure shows an alert with Retry; the invoice is not touched. */
export function DownloadPdfButton({ invoiceId, invoiceNumber }: DownloadPdfButtonProps) {
  const { download, isPending, error } = useInvoicePdf(invoiceId, invoiceNumber);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button type="button" className="min-h-11 px-4" disabled={isPending} onClick={download}>
          <Download aria-hidden="true" />
          {isPending ? "Preparing PDF…" : "Download PDF"}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not download the PDF</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            {error}
            <Button type="button" variant="outline" className="min-h-11 px-4" disabled={isPending} onClick={download}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
