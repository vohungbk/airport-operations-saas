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
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useManualArrivalForm } from "@/features/flights/hooks/use-manual-arrival-form";
import { MANUAL_REASON_MAX_LENGTH } from "@/features/flights/schemas/manual-arrival.schema";

interface ManualArrivalDialogProps {
  bookingId: string;
  flightNumber: string;
  /** The time zone of the airport: the times typed are wall-clock time there. */
  timeZone: string;
  /** True for a booking with no flight yet: the scheduled arrival is asked too. */
  requireScheduled: boolean;
}

/**
 * VI-F02-S07 (spec E6, Q4): the button and form to enter an arrival by hand. Only serializable props cross
 * the Server to Client boundary. The role is checked again by the Server Action and by the database function.
 */
export function ManualArrivalDialog({ bookingId, flightNumber, timeZone, requireScheduled }: ManualArrivalDialogProps) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, isPending, result, reset } = useManualArrivalForm({
    bookingId,
    requireScheduled,
    onSuccess: () => setOpen(false),
  });
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="min-h-11 w-fit px-4" />}>
        Enter arrival by hand
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Enter arrival for {flightNumber}</DialogTitle>
            <DialogDescription>
              The value is marked Manual until the provider returns data after it. Every entry is kept in the
              history with its reason, which is visible to anyone who can see this flight.
            </DialogDescription>
          </DialogHeader>

          {result && !result.success && (
            <Alert variant="destructive">
              <AlertTitle>Could not save the arrival</AlertTitle>
              <AlertDescription>{result.error?.message}</AlertDescription>
            </Alert>
          )}

          {requireScheduled && (
            <Field data-invalid={!!errors.scheduled_arrival_at}>
              <FieldLabel htmlFor="scheduled_arrival_at">Scheduled arrival</FieldLabel>
              <Input
                id="scheduled_arrival_at"
                type="datetime-local"
                aria-invalid={!!errors.scheduled_arrival_at}
                aria-describedby="scheduled_arrival_at-hint scheduled_arrival_at-error"
                disabled={isPending}
                {...register("scheduled_arrival_at")}
              />
              <FieldDescription id="scheduled_arrival_at-hint">
                The provider does not know this flight, so the schedule is needed. Time at the airport ({timeZone}).
              </FieldDescription>
              <FieldErrorMessage
                id="scheduled_arrival_at-error"
                errors={errors.scheduled_arrival_at ? [errors.scheduled_arrival_at] : undefined}
              />
            </Field>
          )}

          <Field data-invalid={!!errors.arrival_at}>
            <FieldLabel htmlFor="arrival_at">Arrival</FieldLabel>
            <Input
              id="arrival_at"
              type="datetime-local"
              aria-invalid={!!errors.arrival_at}
              aria-describedby="arrival_at-hint arrival_at-error"
              disabled={isPending}
              {...register("arrival_at")}
            />
            <FieldDescription id="arrival_at-hint">Time at the airport ({timeZone}).</FieldDescription>
            <FieldErrorMessage id="arrival_at-error" errors={errors.arrival_at ? [errors.arrival_at] : undefined} />
          </Field>

          <Field data-invalid={!!errors.reason}>
            <FieldLabel htmlFor="reason">Reason</FieldLabel>
            <Textarea
              id="reason"
              rows={3}
              maxLength={MANUAL_REASON_MAX_LENGTH}
              aria-invalid={!!errors.reason}
              aria-describedby="reason-error"
              disabled={isPending}
              {...register("reason")}
            />
            <FieldErrorMessage id="reason-error" errors={errors.reason ? [errors.reason] : undefined} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save arrival"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
