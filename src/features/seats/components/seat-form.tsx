"use client";

import type { ReactNode } from "react";
import Link from "next/link";
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
  FieldLabel,
} from "@/components/ui/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatSeatDate } from "@/features/seats/lib/format-seat-date";
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
  placeholder,
  type = "text",
}: FieldShellProps<TFieldValues> & {
  type?: "text" | "number";
  placeholder?: string;
}) {
  const error = fieldError(errors, name);

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        type={type}
        placeholder={placeholder}
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
  hint,
  placeholder = "Select...",
}: Pick<
  FieldShellProps<TFieldValues>,
  "name" | "label" | "errors" | "isPending" | "hint"
> & {
  control: Control<TFieldValues>;
  choices: { value: string; label: string }[];
  placeholder?: string;
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
              aria-describedby={describedBy(name, error, hint)}
              className="w-full"
            >
              <SelectValue placeholder={placeholder} />
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
      {hint && <FieldDescription id={`${name}-hint`}>{hint}</FieldDescription>}
      <FieldErrorMessage
        id={`${name}-error`}
        errors={error ? [error] : undefined}
      />
    </Field>
  );
}

function DateField<TFieldValues extends FieldValues>({
  name,
  label,
  control,
  errors,
  isPending,
}: Pick<FieldShellProps<TFieldValues>, "name" | "label" | "errors" | "isPending"> & {
  control: Control<TFieldValues>;
}) {
  const error = fieldError(errors, name);

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Controller
        control={control}
        name={name as Path<TFieldValues>}
        render={({ field }) => (
          <DatePicker
            value={field.value ?? ""}
            formatValue={formatSeatDate}
            onValueChange={(value) => field.onChange(value)}
            disabled={isPending}
            aria-invalid={!!error}
            placeholder="Pick a date"
          />
        )}
      />
      <FieldErrorMessage
        id={`${name}-error`}
        errors={error ? [error] : undefined}
      />
    </Field>
  );
}

interface FormSectionProps {
  title: string;
  children: ReactNode;
  columns?: "two" | "three";
}

function FormSection({ title, children, columns = "three" }: FormSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div
        className={cn(
          "grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2",
          columns === "three" && "lg:grid-cols-3",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** The make and model of the seat, editable in both modes. */
function ProductFields<TFieldValues extends FieldValues>({
  register,
  errors,
  isPending,
}: Pick<SharedFieldsProps<TFieldValues>, "register" | "errors" | "isPending">) {
  const shell = { register, errors, isPending };

  return (
    <>
      <TextField {...shell} name="manufacturer" label="Manufacturer" />
      <TextField {...shell} name="model" label="Model" />
    </>
  );
}

/** Where the seat is, its category and its rental limits, editable in both modes. */
function ConfigurationFields<TFieldValues extends FieldValues>({
  register,
  control,
  errors,
  isPending,
  options,
}: SharedFieldsProps<TFieldValues>) {
  const shell = { register, errors, isPending };

  return (
    <>
      <SelectField
        control={control}
        errors={errors}
        isPending={isPending}
        name="airport_id"
        label="Airport *"
        placeholder="Select airport"
        hint="Required"
        choices={options.airports}
      />
      <SelectField
        control={control}
        errors={errors}
        isPending={isPending}
        name="category_id"
        label="Category *"
        placeholder="Select category"
        hint="Required"
        choices={options.categories}
      />
      <DateField
        control={control}
        errors={errors}
        isPending={isPending}
        name="manufacture_date"
        label="Manufacture date"
      />
      <DateField
        control={control}
        errors={errors}
        isPending={isPending}
        name="purchase_date"
        label="Purchase date"
      />
      <TextField
        {...shell}
        name="max_rental_cycles"
        label="Max rental cycles"
        type="number"
      />
    </>
  );
}

/** The public token is made by the database, so the form only shows that it is automatic. */
function PublicTokenField() {
  return (
    <Field>
      <FieldLabel htmlFor="public_token">Public token</FieldLabel>
      <Input
        id="public_token"
        value="AUTO-GEN"
        readOnly
        aria-describedby="public_token-hint"
        className="h-11 bg-muted"
      />
      <FieldDescription id="public_token-hint">
        Used to create the permanent QR code
      </FieldDescription>
    </Field>
  );
}

interface SeatFormLayoutProps {
  formId: string;
  title: string;
  cancelHref: string;
  submitLabel: string;
  isPending: boolean;
  onSubmit: () => void;
  alert?: ReactNode;
  children: ReactNode;
}

/** Page heading with Cancel and Save, and the white card that holds the form sections. */
export function SeatFormLayout({
  formId,
  title,
  cancelHref,
  submitLabel,
  isPending,
  onSubmit,
  alert,
  children,
}: SeatFormLayoutProps) {
  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href={cancelHref}
            className={buttonVariants({
              variant: "outline",
              className: "min-h-11 bg-surface px-4 dark:bg-surface",
            })}
          >
            Cancel
          </Link>
          <Button
            type="submit"
            form={formId}
            disabled={isPending}
            className="min-h-11 px-4"
          >
            {submitLabel}
          </Button>
        </div>
      </div>

      {alert}

      <div className="flex flex-col gap-8 rounded-xl border bg-surface p-6">
        {children}
      </div>
    </form>
  );
}

interface SeatFormSectionsProps<TFieldValues extends FieldValues>
  extends SharedFieldsProps<TFieldValues> {
  /** Fields that come before the make and model: the serial and token on create. */
  identity?: ReactNode;
}

function SeatFormSections<TFieldValues extends FieldValues>({
  identity,
  ...shared
}: SeatFormSectionsProps<TFieldValues>) {
  return (
    <>
      <FormSection title="Seat identity" columns="two">
        {identity}
        <ProductFields
          register={shared.register}
          errors={shared.errors}
          isPending={shared.isPending}
        />
      </FormSection>
      <FormSection title="Configuration">
        <ConfigurationFields {...shared} />
      </FormSection>
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
      <SeatFormSections
        register={register}
        control={control}
        errors={errors}
        isPending={isPending}
        options={options}
        identity={
          <>
            <TextField
              register={register}
              errors={errors}
              isPending={isPending}
              name="serial_number"
              label="Serial number *"
              placeholder="Enter a unique serial number"
              hint="Required unique identifier"
            />
            <PublicTokenField />
          </>
        }
      />
    );
  }

  const { register, control, errors, isPending, options } = props;

  return (
    <SeatFormSections
      register={register}
      control={control}
      errors={errors}
      isPending={isPending}
      options={options}
    />
  );
}
