"use client";

import { Controller } from "react-hook-form";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InspectionConflictAlert } from "@/features/inspections/components/inspection-conflict-alert";
import { InspectionDiscardDialog } from "@/features/inspections/components/inspection-discard-dialog";
import { InspectionResultLabel } from "@/features/inspections/components/inspection-result-label";
import { useInspectionPanel } from "@/features/inspections/hooks/use-inspection-panel";
import { isAlreadyRecordedError } from "@/features/inspections/lib/inspection-errors";
import {
  INSPECTION_RESULTS,
  NOTES_MAX_LENGTH,
  inspectionResultLabel,
} from "@/features/inspections/schemas/record-inspection.schema";
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { OfflineBanner } from "@/features/jobs/components/offline-banner";
import { StepActionBar } from "@/features/jobs/components/step-action-bar";

const RESULT_ITEMS = INSPECTION_RESULTS.map((value) => ({
  value,
  label: inspectionResultLabel(value),
}));

interface InspectionPanelProps {
  jobId: string;
  seatId: string;
  seatLabel: string;
}

/**
 * The Inspection record form of the Admin and Operations Manager, as in the
 * design. The seat is shown, not chosen. Notes are required for a conditional
 * pass and a fail. The photo is left out until ticket 319 is done.
 */
export function InspectionPanel({ jobId, seatId, seatLabel }: InspectionPanelProps) {
  const {
    form,
    onSubmit,
    isPending,
    result,
    viewRecordedInspection,
    discardOpen,
    setDiscardOpen,
    onCancel,
    onDiscard,
    notesRequired,
    notesLength,
  } = useInspectionPanel({ jobId, seatId });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const error = result && !result.success ? result.error : undefined;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 pb-24 md:pb-6">
      <h2 className="text-base font-semibold text-foreground">Inspection record</h2>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <OfflineBanner />
        {error &&
          (isAlreadyRecordedError(error) ? (
            <InspectionConflictAlert onViewRecord={viewRecordedInspection} />
          ) : (
            <JobActionErrorAlert
              error={error}
              onRetry={() => void onSubmit()}
              fallbackTitle="Unable to save inspection. Your changes are kept."
            />
          ))}

        <input type="hidden" {...register("job_id")} />
        <input type="hidden" {...register("seat_id")} />

        <Field data-invalid={!!errors.seat_id}>
          <FieldLabel htmlFor="seat">Seat</FieldLabel>
          <div className="relative">
            <Input
              id="seat"
              value={seatLabel}
              readOnly
              disabled
              className="min-h-11 pr-10"
            />
            <Lock
              aria-hidden="true"
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-muted"
            />
          </div>
          <p className="text-sm text-text-muted">Read only</p>
          <FieldErrorMessage
            id="seat-error"
            errors={errors.seat_id ? [errors.seat_id] : undefined}
          />
        </Field>

        <Field data-invalid={!!errors.result}>
          <FieldLabel htmlFor="inspection-result">Inspection result *</FieldLabel>
          <Controller
            control={control}
            name="result"
            render={({ field }) => (
              <Select
                value={field.value ?? null}
                items={RESULT_ITEMS}
                onValueChange={(value) => field.onChange(value)}
                disabled={isPending}
              >
                <SelectTrigger
                  id="inspection-result"
                  className="min-h-11 w-full data-[size=default]:h-11"
                  aria-invalid={!!errors.result}
                  aria-describedby={errors.result ? "result-error" : undefined}
                >
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent>
                  {INSPECTION_RESULTS.map((value) => (
                    <SelectItem key={value} value={value}>
                      <InspectionResultLabel result={value} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {!errors.result && (
            <p className="text-sm text-text-muted">
              Choose Pass, Conditional pass or Fail
            </p>
          )}
          <FieldErrorMessage
            id="result-error"
            errors={errors.result ? [errors.result] : undefined}
          />
        </Field>

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="notes">
            {notesRequired
              ? "Inspection notes (required)"
              : "Inspection notes (optional)"}
          </FieldLabel>
          <Textarea
            id="notes"
            rows={4}
            placeholder="Add inspection notes"
            aria-invalid={!!errors.notes}
            aria-describedby={errors.notes ? "notes-error" : undefined}
            disabled={isPending}
            {...register("notes")}
          />
          <p className="text-sm text-text-muted">
            Internal only · Hidden from Partner User
          </p>
          <p className="text-sm text-text-muted">
            {notesLength} / {NOTES_MAX_LENGTH}
          </p>
          <FieldErrorMessage
            id="notes-error"
            errors={errors.notes ? [errors.notes] : undefined}
          />
        </Field>

        {isPending && (
          <p role="status" className="text-sm text-text-muted">
            Saving inspection. Fields are disabled.
          </p>
        )}

        <StepActionBar>
          <Button type="submit" disabled={isPending} className="min-h-11 flex-1 px-4 md:flex-none">
            {isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onCancel}
            className="min-h-11 flex-1 bg-surface px-4 md:flex-none"
          >
            Cancel
          </Button>
        </StepActionBar>
      </form>
      <InspectionDiscardDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onDiscard={onDiscard}
      />
    </div>
  );
}
