"use client";

import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useIssueInvoice } from "@/features/invoices/hooks/use-issue-invoice";
import type { IssuePreview } from "@/features/invoices/lib/invoice-issue";

interface IssueInvoiceButtonProps {
  invoiceId: string;
  preview: IssuePreview;
}

/**
 * The Issue invoice button of a draft and its confirmation (VI-F09-S07, the Issue confirmation of the design): the
 * issue date, the payment terms and the due date the invoice will get, and Confirm issue. A failure is said in the
 * dialog and Confirm issue can be run again; the invoice is not touched.
 */
export function IssueInvoiceButton({ invoiceId, preview }: IssueInvoiceButtonProps) {
  const [open, setOpen] = useState(false);
  const { issue, isPending, error, reset } = useIssueInvoice(invoiceId, () => setOpen(false));

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) reset();
      }}
    >
      <DialogTrigger render={<Button type="button" className="min-h-11 px-4" />}>Issue invoice</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue invoice</DialogTitle>
          <DialogDescription className="font-semibold text-foreground">{preview.heading}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1 text-sm text-foreground">
          <p>Issue date: {preview.issue_date}</p>
          <p>Payment terms: {preview.payment_terms}</p>
          <p>Due date: {preview.due_date}</p>
        </div>

        <Alert>
          <AlertTitle>Confirm issue</AlertTitle>
          <AlertDescription>
            This changes Draft to Issued. The partner can then view and download the invoice.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not issue the invoice</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" className="min-h-11 px-4" disabled={isPending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="min-h-11 px-4" disabled={isPending} onClick={issue}>
            {isPending ? "Issuing..." : "Confirm issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
