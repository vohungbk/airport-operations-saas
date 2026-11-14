"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import { IncidentPhotosPanel } from "@/features/incidents/components/incident-photos-panel";
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { JOB_TYPE_LABEL } from "@/features/jobs/lib/job-type";
import { useStepPhotoUpload } from "@/features/bookings/hooks/use-step-photo-upload";
import { useReportIncidentForm } from "@/features/incidents/hooks/use-report-incident-form";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABEL,
} from "@/features/incidents/lib/incident-severity";
import type { IncidentJobOption } from "@/features/incidents/lib/get-incident-job-options";

interface IncidentReportFormProps {
  jobs: IncidentJobOption[];
  /** The time the report is made, written in the airport time zone (`04 Nov 2026 11:15 GST`). */
  reportedAt: string;
  /** Short name of the airport time zone (`GST`). */
  zone: string;
  /** A job to select first, or an empty string. */
  initialJobId: string;
  /** Where Cancel goes: the incident list, or the jobs for a technician. */
  cancelHref: string;
}

const CONTROL_CLASS =
  "w-full min-w-0 rounded-lg border border-border-input bg-surface px-3 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

function Required() {
  return <span aria-hidden="true"> *</span>;
}

function Hint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs text-text-muted">
      {children}
    </p>
  );
}

interface SelectFieldProps {
  name: string;
  label: string;
  placeholder: string;
  choices: { value: string; label: string }[];
  hint: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
  isPending: boolean;
}

function SelectField({
  name,
  label,
  placeholder,
  choices,
  hint,
  registration,
  error,
  isPending,
}: SelectFieldProps) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name} className="text-sm font-semibold">
        {label}
        <Required />
      </FieldLabel>
      <select
        id={name}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : `${name}-hint`}
        disabled={isPending}
        className={`h-11 ${CONTROL_CLASS}`}
        {...registration}
      >
        <option value="">{placeholder}</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
      {error ? (
        <FieldErrorMessage id={`${name}-error`} errors={[error]} />
      ) : (
        <Hint id={`${name}-hint`}>{hint}</Hint>
      )}
    </Field>
  );
}

/**
 * Cancel is a plain link: nothing is saved until Submit incident succeeds, so
 * leaving the page discards the draft. Neither severity nor seat has a default
 * choice. The incident is saved against a job: the seat is the seat of the
 * chosen job, and the booking is filled from it. The date and time is the
 * moment of the report; the database sets it.
 */
export function IncidentReportForm({
  jobs,
  reportedAt,
  zone,
  initialJobId,
  cancelHref,
}: IncidentReportFormProps) {
  const { form, onSubmit, isPending, result } = useReportIncidentForm({
    initialJobId,
  });
  const {
    register,
    watch,
    formState: { errors },
  } = form;
  const chosenJob = jobs.find((job) => job.id === watch("job_id"));
  const { canSave, ...photos } = useStepPhotoUpload(chosenJob?.booking_id ?? "", "incident");

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,26rem)]"
    >
      <div className="flex flex-col gap-5">
        {result && !result.success && result.error && (
          <JobActionErrorAlert
            error={result.error}
            fallbackTitle="Could not report incident"
          />
        )}

        <SelectField
          name="job_id"
          label="Seat"
          placeholder="Select a seat"
          choices={jobs.map((job) => ({
            value: job.id,
            label: [
              job.seat_number || "No seat",
              job.booking_number,
              JOB_TYPE_LABEL[job.job_type],
            ]
              .filter(Boolean)
              .join(" - "),
          }))}
          hint="Required - the seat comes from the job"
          registration={register("job_id")}
          error={errors.job_id}
          isPending={isPending}
        />

        <div className="flex flex-col gap-2">
          <span id="booking-label" className="text-sm font-semibold">
            Booking (optional)
          </span>
          <p
            aria-labelledby="booking-label"
            aria-describedby="booking-hint"
            className="min-h-6 text-sm text-foreground"
          >
            {chosenJob?.booking_number || "—"}
          </p>
          <Hint id="booking-hint">Optional - filled from the job of the seat</Hint>
        </div>

        <SelectField
          name="severity"
          label="Severity"
          placeholder="Select severity"
          choices={INCIDENT_SEVERITIES.map((severity) => ({
            value: severity,
            label: INCIDENT_SEVERITY_LABEL[severity],
          }))}
          hint="Low / Medium / High / Critical"
          registration={register("severity")}
          error={errors.severity}
          isPending={isPending}
        />

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description" className="text-sm font-semibold">
            Description
            <Required />
          </FieldLabel>
          <Textarea
            id="description"
            rows={5}
            placeholder="Describe the incident"
            aria-invalid={!!errors.description}
            aria-describedby={
              errors.description ? "description-error" : "description-hint"
            }
            disabled={isPending}
            className="rounded-lg border-border-input bg-surface px-3 text-sm"
            {...register("description")}
          />
          {errors.description ? (
            <FieldErrorMessage
              id="description-error"
              errors={[errors.description]}
            />
          ) : (
            <Hint id="description-hint">
              Required - include fault and immediate action
            </Hint>
          )}
        </Field>

        <div className="flex flex-col gap-2">
          <span id="reported-at-label" className="text-sm font-semibold">
            Date and time
          </span>
          <p
            aria-labelledby="reported-at-label"
            aria-describedby="reported-at-hint"
            className="min-h-6 text-sm text-foreground"
          >
            {reportedAt}
          </p>
          <Hint id="reported-at-hint">
            Set when you submit - airport time zone {zone}
          </Hint>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={isPending || !canSave}
            className="min-h-11 rounded-lg px-4"
          >
            {isPending ? "Submitting..." : "Submit incident"}
          </Button>
          <Link
            href={cancelHref}
            className={buttonVariants({
              variant: "outline",
              className: "min-h-11 rounded-lg bg-surface px-4",
            })}
          >
            Cancel
          </Link>
        </div>
      </div>

      <IncidentPhotosPanel stamp={reportedAt} photos={photos} disabled={!chosenJob} />
    </form>
  );
}
