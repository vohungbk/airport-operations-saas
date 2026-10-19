"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InspectionConflictAlert } from "@/features/inspections/components/inspection-conflict-alert";
import { isAlreadyRecordedError } from "@/features/inspections/lib/inspection-errors";
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { useRecordInspectionForm } from "@/features/inspections/hooks/use-record-inspection-form";
import {
  INSPECTION_RESULTS,
  inspectionResultLabel,
} from "@/features/inspections/schemas/record-inspection.schema";

interface InspectionFormProps {
  jobId: string;
  seatId: string;
  seatLabel: string;
}

const CONTROL_CLASS =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

/**
 * Cancel is a plain link: nothing is saved until Save succeeds, so leaving
 * the page discards the draft. The seat is shown, not chosen: it is the seat
 * of the job's booking. The result is chosen, never defaulted.
 */
export function InspectionForm({
  jobId,
  seatId,
  seatLabel,
}: InspectionFormProps) {
  const { form, onSubmit, isPending, result, viewRecordedInspection } =
    useRecordInspectionForm({ jobId, seatId });
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && result.error && (
        isAlreadyRecordedError(result.error) ? (
          <InspectionConflictAlert onViewRecord={viewRecordedInspection} />
        ) : (
          <JobActionErrorAlert
            error={result.error}
            fallbackTitle="Could not record inspection"
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

      <Field data-invalid={!!errors.result}>
        <FieldLabel>Inspection result</FieldLabel>
        <div className="flex flex-col gap-2 text-sm">
          {INSPECTION_RESULTS.map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                value={value}
                disabled={isPending}
                {...register("result")}
              />
              {inspectionResultLabel(value)}
            </label>
          ))}
        </div>
        <FieldErrorMessage
          id="result-error"
          errors={errors.result ? [errors.result] : undefined}
        />
      </Field>

      <Field data-invalid={!!errors.notes}>
        <FieldLabel htmlFor="notes">Inspection notes (optional)</FieldLabel>
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
