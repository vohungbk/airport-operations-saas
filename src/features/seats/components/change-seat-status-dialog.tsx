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
import {
  Field,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useChangeSeatStatusForm } from "@/features/seats/hooks/use-change-seat-status-form";
import {
  SEAT_STATUS_LABEL,
  type ManualTargetStatus,
} from "@/features/seats/lib/seat-status";

interface ChangeSeatStatusDialogProps {
  seatId: string;
  serialNumber: string;
  allowedStatuses: ManualTargetStatus[];
}

const CONTROL_CLASS =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

/**
 * Only serializable props cross the Server->Client boundary (status
 * strings, not labels/icons/functions). Targets are limited to the manual
 * transitions the server computed; the database re-validates regardless.
 */
export function ChangeSeatStatusDialog({
  seatId,
  serialNumber,
  allowedStatuses,
}: ChangeSeatStatusDialogProps) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, isPending, result, reset } = useChangeSeatStatusForm({
    seatId,
    defaultStatus: allowedStatuses[0],
    onSuccess: () => setOpen(false),
  });
  const {
    register,
    watch,
    formState: { errors },
  } = form;
  const target = watch("to_status");

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        Change status
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Change status of {serialNumber}</DialogTitle>
            <DialogDescription>
              Retiring a seat is permanent. Operational statuses are managed by
              their own workflows.
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
            <select
              id="to_status"
              disabled={isPending}
              className={cn(CONTROL_CLASS, "h-8 py-1")}
              {...register("to_status")}
            >
              {allowedStatuses.map((status) => (
                <option key={status} value={status}>
                  {SEAT_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </Field>

          <Field data-invalid={!!errors.reason}>
            <FieldLabel htmlFor="reason">
              {target === "quarantine" ? "Reason" : "Reason (optional)"}
            </FieldLabel>
            <textarea
              id="reason"
              rows={3}
              aria-invalid={!!errors.reason}
              aria-describedby={errors.reason ? "reason-error" : undefined}
              disabled={isPending}
              className={CONTROL_CLASS}
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
              variant={target === "retired" ? "destructive" : "default"}
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
