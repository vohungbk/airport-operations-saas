"use client";

import type {
  FieldError,
  FieldErrors,
  FieldValues,
  Path,
  UseFormRegister,
} from "react-hook-form";

import {
  Field,
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { SeatFormOptions } from "@/features/seats/lib/get-seat-form-options";
import type {
  CreateSeatInput,
  UpdateSeatInput,
} from "@/features/seats/schemas/seat.schema";

type CreateModeProps = {
  mode: "create";
  register: UseFormRegister<CreateSeatInput>;
  errors: FieldErrors<CreateSeatInput>;
  isPending: boolean;
  options: SeatFormOptions;
};

type EditModeProps = {
  mode: "edit";
  register: UseFormRegister<UpdateSeatInput>;
  errors: FieldErrors<UpdateSeatInput>;
  isPending: boolean;
  options: SeatFormOptions;
};

type SeatFormProps = CreateModeProps | EditModeProps;

interface SharedFieldsProps<TFieldValues extends FieldValues> {
  register: UseFormRegister<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  isPending: boolean;
  options: SeatFormOptions;
}

function describedBy(name: string, error?: FieldError, hint?: string) {
  const ids = [];
  if (hint) ids.push(`${name}-hint`);
  if (error) ids.push(`${name}-error`);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

interface FieldShellProps<TFieldValues extends FieldValues> {
  name: string;
  label: string;
  register: UseFormRegister<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  isPending: boolean;
  hint?: string;
}

function fieldError<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
  name: string,
): FieldError | undefined {
  return (errors as Record<string, FieldError | undefined>)[name];
}

function TextField<TFieldValues extends FieldValues>({
  name,
  label,
  register,
  errors,
  isPending,
  hint,
  type = "text",
}: FieldShellProps<TFieldValues> & { type?: "text" | "number" | "date" }) {
  const error = fieldError(errors, name);

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        type={type}
        min={type === "number" ? 1 : undefined}
        step={type === "number" ? 1 : undefined}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, error, hint)}
        disabled={isPending}
        {...register(
          name as Path<TFieldValues>,
          type === "number" ? { valueAsNumber: true } : {},
        )}
      />
      {hint && <FieldDescription id={`${name}-hint`}>{hint}</FieldDescription>}
      <FieldErrorMessage
        id={`${name}-error`}
        errors={error ? [error] : undefined}
      />
    </Field>
  );
}

function SelectField<TFieldValues extends FieldValues>({
  name,
  label,
  register,
  errors,
  isPending,
  choices,
}: FieldShellProps<TFieldValues> & {
  choices: { value: string; label: string }[];
}) {
  const error = fieldError(errors, name);

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <select
        id={name}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, error)}
        disabled={isPending}
        className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"
        {...register(name as Path<TFieldValues>)}
      >
        <option value="">Select...</option>
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

/** Fields editable in both modes (everything except the create-only serial). */
function SharedFields<TFieldValues extends FieldValues>({
  register,
  errors,
  isPending,
  options,
}: SharedFieldsProps<TFieldValues>) {
  const shell = { register, errors, isPending };

  return (
    <>
      <TextField {...shell} name="manufacturer" label="Manufacturer" />
      <TextField {...shell} name="model" label="Model" />
      <TextField
        {...shell}
        name="manufacture_date"
        label="Manufacture date"
        type="date"
      />
      <TextField
        {...shell}
        name="purchase_date"
        label="Purchase date"
        type="date"
      />
      <TextField
        {...shell}
        name="max_rental_cycles"
        label="Max rental cycles"
        type="number"
      />
      <SelectField
        {...shell}
        name="category_id"
        label="Category"
        choices={options.categories}
      />
      <SelectField
        {...shell}
        name="airport_id"
        label="Airport"
        choices={options.airports}
      />
    </>
  );
}

/**
 * Shared fields for create and edit. `serial_number` exists only on
 * create (immutable afterwards); `public_token`, `status` and
 * `rental_cycles` are never form fields.
 */
export function SeatForm(props: SeatFormProps) {
  if (props.mode === "create") {
    const { register, errors, isPending, options } = props;

    return (
      <FieldGroup>
        <TextField
          register={register}
          errors={errors}
          isPending={isPending}
          name="serial_number"
          label="Serial number"
          hint="Cannot be changed after the seat is created."
        />
        <SharedFields
          register={register}
          errors={errors}
          isPending={isPending}
          options={options}
        />
      </FieldGroup>
    );
  }

  const { register, errors, isPending, options } = props;

  return (
    <FieldGroup>
      <SharedFields
        register={register}
        errors={errors}
        isPending={isPending}
        options={options}
      />
    </FieldGroup>
  );
}
