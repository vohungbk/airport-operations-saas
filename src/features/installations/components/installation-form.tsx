"use client";

import { Controller } from "react-hook-form";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { InstallationChecklistStep } from "@/features/installations/components/installation-checklist-step";
import { InstallationConflictAlert } from "@/features/installations/components/installation-conflict-alert";
import { isAlreadyRecordedError } from "@/features/installations/lib/installation-errors";
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { OfflineBanner } from "@/features/jobs/components/offline-banner";
import { StepActionBar } from "@/features/jobs/components/step-action-bar";
import { StepPhotoField } from "@/features/bookings/components/step-photo-field";
import { useStepPhotoUpload } from "@/features/bookings/hooks/use-step-photo-upload";
import { useRecordInstallationForm } from "@/features/installations/hooks/use-record-installation-form";

interface InstallationFormProps {
  jobId: string;
  /** Shown under the heading, with the booking number and the airport timezone. */
  jobNumber: string;
  bookingNumber: string;
  /** The booking of the job: the installation photos are added to it. */
  bookingId: string;
  seatId: string;
  seatLabel: string;
  timeZone: string;
  defaultInstalledAt: string;
}

/**
 * Two steps in one form (ME3): the checklist first, then the photo, the vehicle location and the time.
 * Cancel is a plain link: nothing is saved until Save succeeds, so leaving
 * the page discards the draft. The seat is shown, not chosen: it is the
 * seat of the job's booking.
 */
export function InstallationForm({
  jobId,
  jobNumber,
  bookingNumber,
  bookingId,
  seatId,
  seatLabel,
  timeZone,
  defaultInstalledAt,
}: InstallationFormProps) {
  const {
    form,
    onSubmit,
    isPending,
    result,
    viewRecordedInstallation,
    discardDraft,
    step,
    backToChecklist,
    continueToDetails,
    checklist,
  } = useRecordInstallationForm({
    jobId,
    seatId,
    timeZone,
    defaultInstalledAt,
  });
  const { canSave, ...photos } = useStepPhotoUpload(bookingId, "installation");
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 pb-24 md:pb-0"
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight break-words text-foreground">
          {step === "checklist"
            ? "Installation checklist"
            : "Installation photos"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {jobNumber} · {bookingNumber} · {timeZone}
        </p>
      </div>
      <OfflineBanner />
      {result &&
        !result.success &&
        result.error &&
        (isAlreadyRecordedError(result.error) ? (
          <InstallationConflictAlert onViewRecord={viewRecordedInstallation} />
        ) : (
          <JobActionErrorAlert
            error={result.error}
            onRetry={() => void onSubmit()}
            fallbackTitle="Could not record installation"
          />
        ))}

      <input type="hidden" {...register("job_id")} />
      <input type="hidden" {...register("seat_id")} />

      {step === "checklist" ? (
        <InstallationChecklistStep
          {...checklist}
          error={errors.checklist?.message}
          onToggle={checklist.toggleItem}
          onContinue={() => void continueToDetails()}
        />
      ) : (
        <>
          <Card className="max-w-lg">
            <CardContent className="flex flex-col gap-5">
              <Field data-invalid={!!errors.seat_id}>
                <FieldLabel htmlFor="seat">Seat</FieldLabel>
                <Input
                  id="seat"
                  value={seatLabel}
                  readOnly
                  disabled={isPending}
                />
                <FieldErrorMessage
                  id="seat-error"
                  errors={errors.seat_id ? [errors.seat_id] : undefined}
                />
              </Field>

              <Field data-invalid={!!errors.installed_at}>
                <FieldLabel htmlFor="installed_at">
                  Installation time
                </FieldLabel>
                <Controller
                  control={control}
                  name="installed_at"
                  render={({ field }) => (
                    <DateTimePicker
                      id="installed_at"
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      timeZone={timeZone}
                      disabled={isPending}
                      aria-invalid={!!errors.installed_at}
                      aria-describedby="installed_at-hint installed_at-error"
                    />
                  )}
                />
                <FieldDescription id="installed_at-hint">
                  Local time at the airport ({timeZone}).
                </FieldDescription>
                <FieldErrorMessage
                  id="installed_at-error"
                  errors={
                    errors.installed_at ? [errors.installed_at] : undefined
                  }
                />
              </Field>

              <Field data-invalid={!!errors.vehicle_location}>
                <FieldLabel htmlFor="vehicle_location">
                  Vehicle location or bay
                </FieldLabel>
                <Input
                  id="vehicle_location"
                  aria-invalid={!!errors.vehicle_location}
                  aria-describedby={
                    errors.vehicle_location
                      ? "vehicle_location-error"
                      : undefined
                  }
                  disabled={isPending}
                  {...register("vehicle_location")}
                />
                <FieldErrorMessage
                  id="vehicle_location-error"
                  errors={
                    errors.vehicle_location
                      ? [errors.vehicle_location]
                      : undefined
                  }
                />
              </Field>

              <Field data-invalid={!!errors.notes}>
                <FieldLabel htmlFor="notes">
                  Installation notes (optional)
                </FieldLabel>
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

              <Field>
                <span className="text-sm font-medium">Installation photos</span>
                <StepPhotoField subject="installation" {...photos} />
              </Field>
            </CardContent>
          </Card>
          <StepActionBar>
            <Button
              type="submit"
              disabled={isPending || !canSave}
              className="min-h-11 px-4"
            >
              {isPending ? "Saving..." : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={backToChecklist}
              className="min-h-11 px-4"
            >
              Back to checklist
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
        </>
      )}
    </form>
  );
}
