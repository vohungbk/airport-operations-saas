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
import { Input } from "@/components/ui/input";
import { InspectionConflictAlert } from "@/features/inspections/components/inspection-conflict-alert";
import { isAlreadyRecordedError } from "@/features/inspections/lib/inspection-errors";
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { OfflineBanner } from "@/features/jobs/components/offline-banner";
import { StepActionBar } from "@/features/jobs/components/step-action-bar";
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
  const { form, onSubmit, isPending, result, viewRecordedInspection, discardDraft } =
    useRecordInspectionForm({ jobId, seatId });
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 pb-24 md:pb-0">
      <OfflineBanner />
      {result &&
        !result.success &&
        result.error &&
        (isAlreadyRecordedError(result.error) ? (
          <InspectionConflictAlert onViewRecord={viewRecordedInspection} />
        ) : (
          <JobActionErrorAlert
            error={result.error}
            onRetry={() => void onSubmit()}
            fallbackTitle="Could not record inspection"
          />
        ))}

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

      <FieldSet
        className="data-[invalid=true]:text-danger-fg"
        data-invalid={!!errors.result}
        aria-describedby={errors.result ? "result-error" : undefined}
      >
        <FieldLegend variant="label">Inspection result</FieldLegend>
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
      </FieldSet>

      <Field data-invalid={!!errors.notes}>
        <FieldLabel htmlFor="notes">Inspection notes (optional)</FieldLabel>
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

      <StepActionBar>
        <Button type="submit" disabled={isPending} className="min-h-11 px-4">
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Link
          href={`/jobs/${jobId}`}
          onClick={discardDraft}
          className={buttonVariants({
            variant: "outline",
            className: "min-h-11 px-4",
          })}
        >
          Cancel
        </Link>
      </StepActionBar>
    </form>
  );
}
