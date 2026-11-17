"use client";

import type { ReactNode } from "react";
import {
  Controller,
  useWatch,
  type Control,
  type FieldError,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";

import {
  Field,
  FieldCounter,
  FieldDescription,
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
import { STATUS_LABEL } from "@/features/partners/components/partner-status-badge";
import {
  PARTNER_NOTES_MAX_LENGTH,
  type CreatePartnerInput,
  type UpdatePartnerInput,
} from "@/features/partners/schemas/partner.schema";
import { PARTNER_STATUSES, type PartnerStatus } from "@/features/partners/types";

/** The statuses a person can choose in the form. A partner that is `pending` or `suspended` keeps its own. */
const CHOOSABLE_STATUSES: PartnerStatus[] = ["active", "inactive"];

type ContactErrors = {
  contact_name?: FieldError;
  contact_email?: FieldError;
  contact_phone?: FieldError;
  notes?: FieldError;
};

type CreateModeProps = {
  mode: "create";
  register: UseFormRegister<CreatePartnerInput>;
  control: Control<CreatePartnerInput>;
  errors: ContactErrors & {
    name?: FieldError;
    code?: FieldError;
    status?: FieldError;
  };
  isPending: boolean;
};

type EditModeProps = {
  mode: "edit";
  register: UseFormRegister<UpdatePartnerInput>;
  control: Control<UpdatePartnerInput>;
  errors: ContactErrors & {
    name?: FieldError;
    status?: FieldError;
  };
  isPending: boolean;
  /** Existing `code`, shown read-only — `code` is immutable after creation. */
  code: string;
};

type PartnerFormProps = CreateModeProps | EditModeProps;

const HELPER_CLASS = "text-xs text-text-muted";

function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint ? <p className={HELPER_CLASS}>{hint}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * Generic text field shared by both modes. Its own `TFieldValues`/`TName`
 * type parameters are inferred fresh at each call site, so a call made
 * from inside the already-narrowed `"create"` or `"edit"` branch below
 * type-checks against that branch's own `register`/schema shape.
 */
function TextField<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>({
  name,
  label,
  placeholder,
  register,
  error,
  isPending,
  required = false,
  type = "text",
  autoComplete,
  helper,
}: {
  name: TName;
  label: string;
  placeholder?: string;
  register: UseFormRegister<TFieldValues>;
  error?: FieldError;
  isPending: boolean;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  helper?: string;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>
        {label}
        {required ? " *" : " (optional)"}
      </FieldLabel>
      <Input
        id={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-required={required || undefined}
        disabled={isPending}
        className="h-11"
        {...register(name)}
      />
      <FieldErrorMessage errors={error ? [error] : undefined} className="text-xs" />
      {helper && !error ? <FieldDescription className={HELPER_CLASS}>{helper}</FieldDescription> : null}
    </Field>
  );
}

function StatusField<TFieldValues extends { status: PartnerStatus } & FieldValues>({
  control,
  error,
  isPending,
}: {
  control: Control<TFieldValues>;
  error?: FieldError;
  isPending: boolean;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor="status">Status</FieldLabel>
      <Controller
        control={control}
        name={"status" as Path<TFieldValues>}
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            disabled={isPending}
          >
            <SelectTrigger
              id="status"
              className="h-11 w-full data-[size=default]:h-11"
            >
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {PARTNER_STATUSES.filter(
                (status) =>
                  CHOOSABLE_STATUSES.includes(status) || status === field.value,
              ).map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <FieldErrorMessage errors={error ? [error] : undefined} className="text-xs" />
    </Field>
  );
}

function NotesField<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>({
  name,
  control,
  register,
  error,
  isPending,
}: {
  name: TName;
  control: Control<TFieldValues>;
  register: UseFormRegister<TFieldValues>;
  error?: FieldError;
  isPending: boolean;
}) {
  const value = useWatch({ control, name }) as string | undefined;

  return (
    <Field data-invalid={!!error} className="sm:col-span-2">
      <FieldLabel htmlFor={name}>Notes (optional)</FieldLabel>
      <Textarea
        id={name}
        placeholder="Add internal notes"
        aria-invalid={!!error}
        disabled={isPending}
        className="min-h-26"
        {...register(name)}
      />
      <FieldErrorMessage errors={error ? [error] : undefined} className="text-xs" />
      <div className="flex items-center gap-3">
        <FieldDescription className={HELPER_CLASS}>
          Visible to internal users only
        </FieldDescription>
        <FieldCounter value={value ?? ""} max={PARTNER_NOTES_MAX_LENGTH} className="ml-0" />
      </div>
    </Field>
  );
}

/**
 * The General and Contact sections of the create and edit forms. `code` is the only field that
 * differs by `mode`: an editable input in `"create"` mode, a disabled input bound to a static value
 * in `"edit"` mode — never registered into the edit form, so there is no path for an edit submission
 * to carry a changed `code` (see `updatePartnerSchema`, which has no `code` field at all).
 */
export function PartnerForm(props: PartnerFormProps) {
  const { isPending } = props;

  return (
    <div className="flex flex-col gap-6">
      <FormSection title="General" hint="Fields marked * are required.">
        {props.mode === "create" ? (
          <>
            <TextField
              name="code"
              label="Partner code"
              placeholder="Enter partner code"
              register={props.register}
              error={props.errors.code}
              isPending={isPending}
              required
              helper="Capital letters, digits and -. Must be unique"
            />
            <TextField
              name="name"
              label="Partner name"
              placeholder="Enter partner name"
              register={props.register}
              error={props.errors.name}
              isPending={isPending}
              required
              autoComplete="organization"
            />
            <StatusField control={props.control} error={props.errors.status} isPending={isPending} />
          </>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="code">Partner code *</FieldLabel>
              <Input
                id="code"
                value={props.code}
                disabled
                readOnly
                className="h-11 disabled:bg-surface-muted disabled:opacity-100"
              />
              <FieldDescription className={HELPER_CLASS}>
                Cannot be changed because this partner has bookings
              </FieldDescription>
            </Field>
            <TextField
              name="name"
              label="Partner name"
              placeholder="Enter partner name"
              register={props.register}
              error={props.errors.name}
              isPending={isPending}
              required
              autoComplete="organization"
            />
            <StatusField control={props.control} error={props.errors.status} isPending={isPending} />
          </>
        )}
      </FormSection>

      <div className="border-t" />

      <FormSection title="Contact">
        {props.mode === "create" ? (
          <>
            <TextField
              name="contact_name"
              label="Contact name"
              placeholder="Enter contact name"
              register={props.register}
              error={props.errors.contact_name}
              isPending={isPending}
              autoComplete="name"
            />
            <TextField
              name="contact_email"
              label="Contact email"
              placeholder="name@company.com"
              register={props.register}
              error={props.errors.contact_email}
              isPending={isPending}
              type="email"
              autoComplete="email"
            />
            <TextField
              name="contact_phone"
              label="Contact phone"
              placeholder="Enter phone number"
              register={props.register}
              error={props.errors.contact_phone}
              isPending={isPending}
              type="tel"
              autoComplete="tel"
            />
            <NotesField
              name="notes"
              control={props.control}
              register={props.register}
              error={props.errors.notes}
              isPending={isPending}
            />
          </>
        ) : (
          <>
            <TextField
              name="contact_name"
              label="Contact name"
              placeholder="Enter contact name"
              register={props.register}
              error={props.errors.contact_name}
              isPending={isPending}
              autoComplete="name"
            />
            <TextField
              name="contact_email"
              label="Contact email"
              placeholder="name@company.com"
              register={props.register}
              error={props.errors.contact_email}
              isPending={isPending}
              type="email"
              autoComplete="email"
            />
            <TextField
              name="contact_phone"
              label="Contact phone"
              placeholder="Enter phone number"
              register={props.register}
              error={props.errors.contact_phone}
              isPending={isPending}
              type="tel"
              autoComplete="tel"
            />
            <NotesField
              name="notes"
              control={props.control}
              register={props.register}
              error={props.errors.notes}
              isPending={isPending}
            />
          </>
        )}
      </FormSection>
    </div>
  );
}
