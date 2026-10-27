"use client";

import {
  Controller,
  type Control,
  type FieldError,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";

import {
  Field,
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldGroup,
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
import type { SeatFormOptions } from "@/features/seats/lib/get-seat-form-options";
import type {
  CreateSeatInput,
  UpdateSeatInput,
} from "@/features/seats/schemas/seat.schema";

type CreateModeProps = {
  mode: "create";
  register: UseFormRegister<CreateSeatInput>;
  control: Control<CreateSeatInput>;
  errors: FieldErrors<CreateSeatInput>;
  isPending: boolean;
  options: SeatFormOptions;
};

type EditModeProps = {
  mode: "edit";
  register: UseFormRegister<UpdateSeatInput>;
  control: Control<UpdateSeatInput>;
  errors: FieldErrors<UpdateSeatInput>;
  isPending: boolean;
  options: SeatFormOptions;
};

type SeatFormProps = CreateModeProps | EditModeProps;

interface SharedFieldsProps<TFieldValues extends FieldValues> {
  register: UseFormRegister<TFieldValues>;
  control: Control<TFieldValues>;
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
  control,
  errors,
  isPending,
  choices,
}: Pick<FieldShellProps<TFieldValues>, "name" | "label" | "errors" | "isPending"> & {
  control: Control<TFieldValues>;
  choices: { value: string; label: string }[];
}) {
  const error = fieldError(errors, name);

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Controller
        control={control}
        name={name as Path<TFieldValues>}
        render={({ field }) => (
          <Select
            value={field.value ?? ""}
            items={choices}
            onValueChange={(value) => field.onChange(value)}
            disabled={isPending}
          >
            <SelectTrigger
              id={name}
              aria-invalid={!!error}
              aria-describedby={describedBy(name, error)}
              className="w-full"
            >
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {choices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
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
  control,
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
        control={control}
        errors={errors}
        isPending={isPending}
        name="category_id"
        label="Category"
        choices={options.categories}
      />
      <SelectField
        control={control}
        errors={errors}
        isPending={isPending}
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
    const { register, control, errors, isPending, options } = props;

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
          control={control}
          errors={errors}
          isPending={isPending}
          options={options}
        />
      </FieldGroup>
    );
  }

  const { register, control, errors, isPending, options } = props;

  return (
    <FieldGroup>
      <SharedFields
        register={register}
        control={control}
        errors={errors}
        isPending={isPending}
        options={options}
      />
    </FieldGroup>
  );
}
