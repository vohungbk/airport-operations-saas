"use client";

import Link from "next/link";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import { useCreateJobForm } from "@/features/jobs/hooks/use-create-job-form";
import { JOB_TYPES, JOB_TYPE_LABEL } from "@/features/jobs/lib/job-type";
import type { JobFormOptions } from "@/features/jobs/lib/get-job-form-options";

interface CreateJobFormProps {
  options: JobFormOptions;
}

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

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
        className={SELECT_CLASS}
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
 * Cancel is a plain link: nothing is saved until Save succeeds, so leaving
 * the page discards the draft.
 */
export function CreateJobForm({ options }: CreateJobFormProps) {
  const { form, onSubmit, isPending, result } = useCreateJobForm();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not create job</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <SelectField
        name="job_type"
        label="Job type"
        placeholder="Select a job type"
        choices={JOB_TYPES.map((type) => ({
          value: type,
          label: JOB_TYPE_LABEL[type],
        }))}
        registration={register("job_type")}
        error={errors.job_type}
        isPending={isPending}
      />
      <SelectField
        name="technician_id"
        label="Technician"
        placeholder="Select a technician"
        choices={options.technicians}
        registration={register("technician_id")}
        error={errors.technician_id}
        isPending={isPending}
      />
      <SelectField
        name="booking_id"
        label="Booking"
        placeholder="Select a booking"
        choices={options.bookings}
        registration={register("booking_id")}
        error={errors.booking_id}
        isPending={isPending}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
