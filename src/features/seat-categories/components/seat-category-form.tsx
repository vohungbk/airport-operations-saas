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
import { cn } from "@/lib/utils";
import type {
  CreateSeatCategoryInput,
  UpdateSeatCategoryInput,
} from "@/features/seat-categories/schemas/seat-category.schema";

type CreateModeProps = {
  mode: "create";
  register: UseFormRegister<CreateSeatCategoryInput>;
  errors: FieldErrors<CreateSeatCategoryInput>;
  isPending: boolean;
};

type EditModeProps = {
  mode: "edit";
  register: UseFormRegister<UpdateSeatCategoryInput>;
  errors: FieldErrors<UpdateSeatCategoryInput>;
  isPending: boolean;
};

type SeatCategoryFormProps = CreateModeProps | EditModeProps;

interface BaseFieldProps<
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
> {
  name: TName;
  label: string;
  register: UseFormRegister<TFieldValues>;
  error?: FieldError;
  isPending: boolean;
  hint?: string;
}

function describedBy(name: string, error?: FieldError, hint?: string) {
  const ids = [];
  if (hint) ids.push(`${name}-hint`);
  if (error) ids.push(`${name}-error`);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function TextField<
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
>({
  name,
  label,
  register,
  error,
  isPending,
  hint,
  type = "text",
}: BaseFieldProps<TFieldValues, TName> & { type?: "text" | "number" }) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? 1 : undefined}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, error, hint)}
        disabled={isPending}
        {...register(name, type === "number" ? { valueAsNumber: true } : {})}
      />
      {hint && <FieldDescription id={`${name}-hint`}>{hint}</FieldDescription>}
      <FieldErrorMessage
        id={`${name}-error`}
        errors={error ? [error] : undefined}
      />
    </Field>
  );
}

function TextareaField<
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
>({
  name,
  label,
  register,
  error,
  isPending,
  hint,
}: BaseFieldProps<TFieldValues, TName>) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <textarea
        id={name}
        rows={3}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, error, hint)}
        disabled={isPending}
        className={cn(
          "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
        )}
        {...register(name)}
      />
      {hint && <FieldDescription id={`${name}-hint`}>{hint}</FieldDescription>}
      <FieldErrorMessage
        id={`${name}-error`}
        errors={error ? [error] : undefined}
      />
    </Field>
  );
}

/**
 * Shared fields for create and edit. `is_active` is only a create-time
 * checkbox; afterwards activation changes only through the dedicated
 * Activate/Deactivate action, so the edit schema has no such field.
 * Age fields are in months (`valueAsNumber` keeps them numeric).
 */
export function SeatCategoryForm(props: SeatCategoryFormProps) {
  const { isPending } = props;

  if (props.mode === "create") {
    const { register, errors } = props;

    return (
      <FieldGroup>
        <TextField
          name="name"
          label="Name"
          register={register}
          error={errors.name}
          isPending={isPending}
        />
        <TextareaField
          name="description"
          label="Description (optional)"
          register={register}
          error={errors.description}
          isPending={isPending}
        />
        <TextField
          name="min_child_age"
          label="Minimum age (months)"
          type="number"
          register={register}
          error={errors.min_child_age}
          isPending={isPending}
        />
        <TextField
          name="max_child_age"
          label="Maximum age (months)"
          type="number"
          register={register}
          error={errors.max_child_age}
          isPending={isPending}
        />
        <TextField
          name="safety_standard"
          label="Safety standard"
          register={register}
          error={errors.safety_standard}
          isPending={isPending}
          hint="e.g. ECE R129 (i-Size)"
        />
        <Field orientation="horizontal">
          <input
            id="is_active"
            type="checkbox"
            disabled={isPending}
            className="size-4 rounded border-input focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            {...register("is_active")}
          />
          <FieldLabel htmlFor="is_active">Active</FieldLabel>
        </Field>
      </FieldGroup>
    );
  }

  const { register, errors } = props;

  return (
    <FieldGroup>
      <TextField
        name="name"
        label="Name"
        register={register}
        error={errors.name}
        isPending={isPending}
      />
      <TextareaField
        name="description"
        label="Description (optional)"
        register={register}
        error={errors.description}
        isPending={isPending}
      />
      <TextField
        name="min_child_age"
        label="Minimum age (months)"
        type="number"
        register={register}
        error={errors.min_child_age}
        isPending={isPending}
      />
      <TextField
        name="max_child_age"
        label="Maximum age (months)"
        type="number"
        register={register}
        error={errors.max_child_age}
        isPending={isPending}
      />
      <TextField
        name="safety_standard"
        label="Safety standard"
        register={register}
        error={errors.safety_standard}
        isPending={isPending}
        hint="e.g. ECE R129 (i-Size)"
      />
    </FieldGroup>
  );
}
