"use client";

import Link from "next/link";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { JOB_TYPE_LABEL } from "@/features/jobs/lib/job-type";
import { useReportIncidentForm } from "@/features/incidents/hooks/use-report-incident-form";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABEL,
} from "@/features/incidents/lib/incident-severity";
import type { IncidentJobOption } from "@/features/incidents/lib/get-incident-job-options";

interface IncidentReportFormProps {
  jobs: IncidentJobOption[];
  /** A job to select first, or an empty string. */
  initialJobId: string;
  /** Where Cancel goes: the incident list, or the jobs for a technician. */
  cancelHref: string;
}

const CONTROL_CLASS =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

interface SelectFieldProps {
  name: string;
  label: string;
  placeholder: string;
  choices: { value: string; label: string }[];
  registration: UseFormRegisterReturn;
  error?: FieldError;
  isPending: boolean;
}

function SelectField({
  name,
  label,
  placeholder,
  choices,
  registration,
  error,
  isPending,
}: SelectFieldProps) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <select
        id={name}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
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
      <FieldErrorMessage
        id={`${name}-error`}
        errors={error ? [error] : undefined}
      />
    </Field>
  );
}

/**
 * Cancel is a plain link: nothing is saved until Save succeeds, so leaving the
 * page discards the draft. Neither severity nor job has a default choice.
 */
export function IncidentReportForm({
  jobs,
  initialJobId,
  cancelHref,
}: IncidentReportFormProps) {
  const { form, onSubmit, isPending, result } = useReportIncidentForm({
    initialJobId,
  });
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && result.error && (
        <JobActionErrorAlert
          error={result.error}
          fallbackTitle="Could not report incident"
        />
      )}

      <SelectField
        name="job_id"
        label="Related job"
        placeholder="Select a job"
        choices={jobs.map((job) => ({
          value: job.id,
          label: `${job.booking_number} - ${JOB_TYPE_LABEL[job.job_type]}`,
        }))}
        registration={register("job_id")}
        error={errors.job_id}
        isPending={isPending}
      />
      <SelectField
        name="severity"
        label="Severity"
        placeholder="Select a severity"
        choices={INCIDENT_SEVERITIES.map((severity) => ({
          value: severity,
          label: INCIDENT_SEVERITY_LABEL[severity],
        }))}
        registration={register("severity")}
        error={errors.severity}
        isPending={isPending}
      />

      <Field data-invalid={!!errors.description}>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Textarea
          id="description"
          rows={5}
          aria-invalid={!!errors.description}
          aria-describedby={
            errors.description ? "description-error" : undefined
          }
          disabled={isPending}
          {...register("description")}
        />
        <FieldErrorMessage
          id="description-error"
          errors={errors.description ? [errors.description] : undefined}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending} className="min-h-11 px-4">
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Link
          href={cancelHref}
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
