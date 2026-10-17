"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CleaningConflictAlert } from "@/features/cleaning/components/cleaning-conflict-alert";
import { isAlreadyRecordedError } from "@/features/cleaning/lib/cleaning-errors";
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { useRecordCleaningForm } from "@/features/cleaning/hooks/use-record-cleaning-form";

interface CleaningFormProps {
  jobId: string;
  seatId: string;
  seatLabel: string;
  timeZone: string;
  defaultCleanedAt: string;
}

const CONTROL_CLASS =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

/**
 * Cancel is a plain link: nothing is saved until Save succeeds, so leaving
 * the page discards the draft. The seat is shown, not chosen: it is the
 * seat of the job's booking.
 */
export function CleaningForm({
  jobId,
  seatId,
  seatLabel,
  timeZone,
  defaultCleanedAt,
}: CleaningFormProps) {
  const { form, onSubmit, isPending, result, viewRecordedCleaning } =
    useRecordCleaningForm({
      jobId,
      seatId,
      timeZone,
      defaultCleanedAt,
    });
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && result.error && (
        isAlreadyRecordedError(result.error) ? (
          <CleaningConflictAlert onViewRecord={viewRecordedCleaning} />
        ) : (
          <JobActionErrorAlert
            error={result.error}
            fallbackTitle="Could not record cleaning"
          />
        )
      )}

      <input type="hidden" {...register("job_id")} />
      <input type="hidden" {...register("seat_id")} />

      <Field data-invalid={!!errors.seat_id}>
        <FieldLabel htmlFor="seat">Seat</FieldLabel>
        <Input id="seat" value={seatLabel} readOnly disabled={isPending} />
        <FieldErrorMessage
          id="seat-error"
          errors={errors.seat_id ? [errors.seat_id] : undefined}
        />
      </Field>

      <Field data-invalid={!!errors.cleaned_at}>
        <FieldLabel htmlFor="cleaned_at">Cleaning time</FieldLabel>
        <Input
          id="cleaned_at"
          type="datetime-local"
          aria-invalid={!!errors.cleaned_at}
          aria-describedby="cleaned_at-hint cleaned_at-error"
          disabled={isPending}
          {...register("cleaned_at")}
        />
        <FieldDescription id="cleaned_at-hint">
          Local time at the airport ({timeZone}).
        </FieldDescription>
        <FieldErrorMessage
          id="cleaned_at-error"
          errors={errors.cleaned_at ? [errors.cleaned_at] : undefined}
        />
      </Field>

      <Field data-invalid={!!errors.notes}>
        <FieldLabel htmlFor="notes">Cleaning notes (optional)</FieldLabel>
        <textarea
          id="notes"
          rows={4}
          aria-invalid={!!errors.notes}
          aria-describedby={errors.notes ? "notes-error" : undefined}
          disabled={isPending}
          className={CONTROL_CLASS}
          {...register("notes")}
        />
        <FieldErrorMessage
          id="notes-error"
          errors={errors.notes ? [errors.notes] : undefined}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Link
          href={`/jobs/${jobId}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
