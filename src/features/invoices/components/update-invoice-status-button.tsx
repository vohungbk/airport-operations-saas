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
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateInvoiceStatus } from "@/features/invoices/hooks/use-update-invoice-status";
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/features/invoices/lib/invoice-list";
import { STATUS_REASON_MAX } from "@/features/invoices/lib/invoice-status";

export interface UpdateInvoiceStatusButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  current: InvoiceStatus;
}

/**
 * Update payment status (VI-F09-S08, spec F1, R6): a dialog with the statuses the invoice can move to, a reason (needed
 * for a void), and Confirm. A move that is not allowed is not offered, and a failure is said in the dialog with the
 * entries kept, so Confirm can be run again. There is no frame for it in the design; it is built like the Issue
 * confirmation.
 */
export function UpdateInvoiceStatusButton({ invoiceId, invoiceNumber, current }: UpdateInvoiceStatusButtonProps) {
  const [open, setOpen] = useState(false);
  const { options, status, reason, error, isPending, needsReason, selectStatus, changeReason, update, reset } =
    useUpdateInvoiceStatus(invoiceId, current, () => setOpen(false));

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) reset();
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" className="min-h-11 px-4" />}>
        Update status
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update payment status</DialogTitle>
          <DialogDescription className="font-mono font-semibold text-foreground">{invoiceNumber}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-foreground">Current: {INVOICE_STATUS_LABEL[current]}</p>

        <Field>
          <FieldLabel htmlFor="invoice_status">New status</FieldLabel>
          <Select
            value={status ?? ""}
            onValueChange={(value) => selectStatus(value as InvoiceStatus)}
            disabled={isPending}
          >
            <SelectTrigger id="invoice_status" className="w-full">
              <SelectValue placeholder="Choose a status" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {INVOICE_STATUS_LABEL[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="invoice_status_reason">{needsReason ? "Reason" : "Reason (optional)"}</FieldLabel>
          <Textarea
            id="invoice_status_reason"
            value={reason}
            maxLength={STATUS_REASON_MAX}
            disabled={isPending}
            aria-required={needsReason}
            onChange={(event) => changeReason(event.target.value)}
          />
        </Field>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not update the status</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" className="min-h-11 px-4" disabled={isPending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="min-h-11 px-4" disabled={isPending} onClick={update}>
            {isPending ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
