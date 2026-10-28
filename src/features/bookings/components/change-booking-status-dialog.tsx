"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";

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
import {
  Field,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useChangeBookingStatusForm } from "@/features/bookings/hooks/use-change-booking-status-form";
import {
  BOOKING_STATUS_LABEL,
  isReasonRequired,
  type ManualTargetStatus,
} from "@/features/bookings/lib/booking-status";

interface ChangeBookingStatusDialogProps {
  bookingId: string;
  bookingNumber: string;
  allowedStatuses: ManualTargetStatus[];
}

/**
 * Only serializable props cross the Server->Client boundary (status
 * strings, not labels/icons/functions). Targets are limited to the manual
 * transitions the server computed; the database re-validates regardless.
 */
export function ChangeBookingStatusDialog({
  bookingId,
  bookingNumber,
  allowedStatuses,
}: ChangeBookingStatusDialogProps) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, isPending, result, reset } =
    useChangeBookingStatusForm({
      bookingId,
      defaultStatus: allowedStatuses[0],
      onSuccess: () => setOpen(false),
    });
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;
  const target = watch("to_status");
  const reasonRequired = isReasonRequired(target);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) reset();
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" className="min-h-11 px-4" />}
      >
        Change status
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Change status of {bookingNumber}</DialogTitle>
            <DialogDescription>
              Cancelled and no-show bookings cannot be changed again.
              Operational statuses are managed by their own workflows.
            </DialogDescription>
          </DialogHeader>

          {result && !result.success && (
            <Alert variant="destructive">
              <AlertTitle>Could not change status</AlertTitle>
              <AlertDescription>{result.error?.message}</AlertDescription>
            </Alert>
          )}

          <Field data-invalid={!!errors.to_status}>
            <FieldLabel htmlFor="to_status">New status</FieldLabel>
            <Controller
              control={control}
              name="to_status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  items={allowedStatuses.map((status) => ({
                    value: status,
                    label: BOOKING_STATUS_LABEL[status],
                  }))}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={isPending}
                >
                  <SelectTrigger id="to_status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {BOOKING_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field data-invalid={!!errors.reason}>
            <FieldLabel htmlFor="reason">
              {reasonRequired ? "Reason" : "Reason (optional)"}
            </FieldLabel>
            <Textarea
              id="reason"
              rows={3}
              aria-invalid={!!errors.reason}
              aria-describedby={errors.reason ? "reason-error" : undefined}
              disabled={isPending}
              {...register("reason")}
            />
            <FieldErrorMessage
              id="reason-error"
              errors={errors.reason ? [errors.reason] : undefined}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={reasonRequired ? "destructive" : "default"}
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
