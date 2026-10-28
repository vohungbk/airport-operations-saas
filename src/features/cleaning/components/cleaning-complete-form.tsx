"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldError as FieldErrorMessage,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { CleaningConflictAlert } from "@/features/cleaning/components/cleaning-conflict-alert";
import { isAlreadyRecordedError } from "@/features/cleaning/lib/cleaning-errors";
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { useCompleteCleaningForm } from "@/features/cleaning/hooks/use-complete-cleaning-form";

interface CleaningCompleteFormProps {
  jobId: string;
  seatLabel: string;
  /** Start time and who started, already formatted for the airport. */
  startedLabel: string;
}

/**
 * Step two. The result is chosen, never defaulted: a passed cleaning returns
 * the seat to available, a failed one does not.
 */
export function CleaningCompleteForm({
  jobId,
  seatLabel,
  startedLabel,
}: CleaningCompleteFormProps) {
  const { form, onSubmit, isPending, result, viewCleaning } =
    useCompleteCleaningForm(jobId);
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result &&
        !result.success &&
        result.error &&
        (isAlreadyRecordedError(result.error) ? (
          <CleaningConflictAlert
            message="Someone completed this cleaning first. Your result was not saved."
            onViewRecord={viewCleaning}
          />
        ) : (
          <JobActionErrorAlert
            error={result.error}
            fallbackTitle="Could not complete the cleaning"
          />
        ))}

      <input type="hidden" {...register("job_id")} />

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Seat</dt>
          <dd className="mt-1 text-sm text-foreground">{seatLabel}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Started</dt>
          <dd className="mt-1 text-sm text-foreground">{startedLabel}</dd>
        </div>
      </dl>

      <FieldSet
        className="data-[invalid=true]:text-danger-fg"
        data-invalid={!!errors.result}
        aria-describedby={errors.result ? "result-error" : undefined}
      >
        <FieldLegend variant="label">Result</FieldLegend>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="passed"
              disabled={isPending}
              {...register("result")}
            />
            Passed: the seat is ready to use
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="failed"
              disabled={isPending}
              {...register("result")}
            />
            Failed: the seat is held for a manager
          </label>
        </div>
        <FieldErrorMessage
          id="result-error"
          errors={errors.result ? [errors.result] : undefined}
        />
      </FieldSet>

      <Field data-invalid={!!errors.notes}>
        <FieldLabel htmlFor="notes">Cleaning notes (optional)</FieldLabel>
        <Textarea
          id="notes"
          rows={4}
          aria-invalid={!!errors.notes}
          aria-describedby={errors.notes ? "notes-error" : undefined}
          disabled={isPending}
          {...register("notes")}
        />
        <FieldErrorMessage
          id="notes-error"
          errors={errors.notes ? [errors.notes] : undefined}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending} className="min-h-11 px-4">
          {isPending ? "Saving..." : "Complete cleaning"}
        </Button>
        <Link
          href={`/jobs/${jobId}`}
          className={buttonVariants({
            variant: "outline",
            className: "min-h-11 px-4",
          })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
