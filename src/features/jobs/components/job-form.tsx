"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Controller,
  type FieldError,
  type UseFormRegisterReturn,
} from "react-hook-form";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { TechnicianPicker } from "@/features/jobs/components/technician-picker";
import { useJobForm } from "@/features/jobs/hooks/use-job-form";
import { JOB_TYPES, JOB_TYPE_LABEL } from "@/features/jobs/lib/job-type";
import type { JobFormOptions } from "@/features/jobs/lib/get-job-form-options";
import type { CreateJobInput } from "@/features/jobs/schemas/create-job.schema";

/** What an edit needs: the job, its current values and the booking it is fixed to. */
export interface JobFormEdit {
  jobId: string;
  defaultValues: CreateJobInput;
  bookingNumber: string;
}

interface JobFormProps {
  options: JobFormOptions;
  edit?: JobFormEdit;
}

const CONTROL_CLASS =
  "h-11 w-full min-w-0 rounded-lg border border-border-input bg-surface px-3 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

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
  required?: boolean;
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
  required = true,
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
        {required && <span aria-hidden="true"> *</span>}
      </FieldLabel>
      <select
        id={name}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : `${name}-hint`}
        disabled={isPending}
        className={CONTROL_CLASS}
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
 * The Job assignment card of Create job and Edit job. Cancel is a plain
 * link: nothing is saved until Save succeeds, so leaving the page discards
 * the draft. On an edit the booking is shown but cannot be changed.
 */
export function JobForm({ options, edit }: JobFormProps) {
  const { form, onSubmit, isPending, result } = useJobForm({
    jobId: edit?.jobId,
    defaultValues: edit?.defaultValues,
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border bg-surface"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">
            Job assignment
          </h2>
          <p className="text-sm text-text-muted">
            {edit
              ? "Job status is changed from Job detail."
              : "Choose a job type, technician and related record."}
          </p>
        </div>

        {result && !result.success && result.error && (
          <JobActionErrorAlert
            error={result.error}
            fallbackTitle={edit ? "Could not save job" : "Could not create job"}
          />
        )}

        <SelectField
          name="job_type"
          label="Job type"
          placeholder="Select job type"
          choices={JOB_TYPES.map((type) => ({
            value: type,
            label: JOB_TYPE_LABEL[type],
          }))}
          hint="Installation, Cleaning or Inspection"
          registration={register("job_type")}
          error={errors.job_type}
          isPending={isPending}
        />
        <Field data-invalid={!!errors.technician_id}>
          <FieldLabel htmlFor="technician_id" className="text-sm font-semibold">
            Technician
            <span aria-hidden="true"> *</span>
          </FieldLabel>
          <Controller
            control={control}
            name="technician_id"
            render={({ field }) => (
              <TechnicianPicker
                id="technician_id"
                technicians={options.technicians}
                value={field.value}
                onChange={field.onChange}
                disabled={isPending}
                invalid={!!errors.technician_id}
                describedBy={
                  errors.technician_id
                    ? "technician_id-error"
                    : "technician_id-hint"
                }
              />
            )}
          />
          {errors.technician_id ? (
            <FieldErrorMessage
              id="technician_id-error"
              errors={[errors.technician_id]}
            />
          ) : (
            <Hint id="technician_id-hint">
              The selected technician will see this job in their list.
            </Hint>
          )}
        </Field>
        {edit ? (
          <div className="flex flex-col gap-2">
            <span id="booking-label" className="text-sm font-semibold">
              Related booking
            </span>
            <p
              aria-labelledby="booking-label"
              aria-describedby="booking-hint"
              className="min-h-6 text-sm text-foreground"
            >
              {edit.bookingNumber}
            </p>
            <Hint id="booking-hint">The booking cannot be changed</Hint>
          </div>
        ) : (
          <SelectField
            name="booking_id"
            label="Related booking"
            placeholder="Select a booking"
            choices={options.bookings}
            hint="Required - link an existing booking"
            registration={register("booking_id")}
            error={errors.booking_id}
            isPending={isPending}
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
        <Link
          href={edit ? `/jobs/${edit.jobId}` : "/jobs"}
          className={buttonVariants({
            variant: "outline",
            className: "min-h-11 rounded-lg bg-surface px-4",
          })}
        >
          Cancel
        </Link>
        <Button
          type="submit"
          disabled={isPending}
          className="min-h-11 min-w-[84px] rounded-lg px-4"
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
