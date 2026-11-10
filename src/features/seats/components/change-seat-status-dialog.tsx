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
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import { useChangeSeatStatusForm } from "@/features/seats/hooks/use-change-seat-status-form";
import {
  SEAT_STATUS_LABEL,
  type ManualTargetStatus,
} from "@/features/seats/lib/seat-status";
import type { SeatStatus } from "@/features/seats/types";

interface ChangeSeatStatusDialogProps {
  seatId: string;
  serialNumber: string;
  /** The status the seat has now. */
  currentStatus: SeatStatus;
  /** Shown after the serial number; left out when the seat has no airport. */
  airportLabel?: string;
  allowedStatuses: ManualTargetStatus[];
}

/**
 * Only serializable props cross the Server->Client boundary (status
 * strings, not labels/icons/functions). Targets are limited to the manual
 * transitions the server computed; the database re-validates regardless.
 */
export function ChangeSeatStatusDialog({
  seatId,
  serialNumber,
  currentStatus,
  airportLabel,
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
    control,
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
      <DialogTrigger render={<Button variant="outline" className="min-h-11 bg-surface dark:bg-surface" />}>
        Change status
      </DialogTrigger>
      <DialogContent className="md:w-[480px] md:max-w-[480px]">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>
              {airportLabel ? `${serialNumber} · ${airportLabel}` : serialNumber}
            </DialogDescription>
          </DialogHeader>

          {result && !result.success && (
            <Alert variant="destructive">
              <AlertTitle>Could not change status</AlertTitle>
              <AlertDescription>{result.error?.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-4 text-sm">
            <span className="w-24 shrink-0 text-text-muted">Current status</span>
            <SeatStatusBadge status={currentStatus} />
          </div>

          <Field
            data-invalid={!!errors.to_status}
            orientation="horizontal"
            className="*:data-[slot=field-label]:flex-none"
          >
            <FieldLabel htmlFor="to_status" className="w-24 shrink-0 text-text-muted">
              New status <span aria-hidden="true">*</span>
            </FieldLabel>
            <Controller
              control={control}
              name="to_status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  items={allowedStatuses.map((status) => ({ value: status, label: SEAT_STATUS_LABEL[status] }))}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={isPending}
                >
                  <SelectTrigger id="to_status" className="w-full min-w-0 flex-1 bg-surface data-[size=default]:h-11 dark:bg-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {SEAT_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {target === "quarantine" && (
            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="reason">
                Reason
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
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 min-w-[90px] bg-surface dark:bg-surface"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={target === "retired" ? "destructive" : "default"}
              className="min-h-11 min-w-[120px]"
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
