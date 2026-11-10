"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AdjustmentForm } from "@/features/bookings/components/adjustment-form";

interface AddAdjustmentDialogProps {
  bookingId: string;
  bookingNumber: string;
  /** The gross revenue the booking has now: the most an adjustment can be. */
  maxAmount: number;
}

/** "Add adjustment" of the Revenue tab (UI-F06-T04): the form in a dialog; it closes when the adjustment is recorded. */
export function AddAdjustmentDialog({ bookingId, bookingNumber, maxAmount }: AddAdjustmentDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="min-h-11 px-4" />}>Add adjustment</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add adjustment</DialogTitle>
          <DialogDescription>{bookingNumber}</DialogDescription>
        </DialogHeader>
        <AdjustmentForm
          bookingId={bookingId}
          maxAmount={maxAmount}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
