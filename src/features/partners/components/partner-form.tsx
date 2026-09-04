"use client";

import {
  Controller,
  type Control,
  type FieldError,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";

import { Field, FieldError as FieldErrorMessage, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PARTNER_STATUSES, type PartnerStatus } from "@/features/partners/types";
import type {
  CreatePartnerInput,
  UpdatePartnerInput,
} from "@/features/partners/schemas/partner.schema";

const STATUS_LABEL: Record<PartnerStatus, string> = {
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
  inactive: "Inactive",
};

type CreateModeProps = {
  mode: "create";
  register: UseFormRegister<CreatePartnerInput>;
  control: Control<CreatePartnerInput>;
  errors: {
    name?: FieldError;
    code?: FieldError;
    contact_email?: FieldError;
    status?: FieldError;
  };
  isPending: boolean;
};

type EditModeProps = {
  mode: "edit";
  register: UseFormRegister<UpdatePartnerInput>;
  control: Control<UpdatePartnerInput>;
  errors: {
    name?: FieldError;
    contact_email?: FieldError;
    status?: FieldError;
  };
  isPending: boolean;
  /** Existing `code`, shown read-only — `code` is immutable after creation. */
  code: string;
};

type PartnerFormProps = CreateModeProps | EditModeProps;

/**
 * Generic text field shared by both modes. Its own `TFieldValues`/`TName`
 * type parameters are inferred fresh at each call site, so a call made
 * from inside the already-narrowed `"create"` or `"edit"` branch below
 * type-checks against that branch's own `register`/schema shape — this
 * is what lets one implementation serve both forms without a cast.
 */
function TextField<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>({
  name,
  label,
  register,
  error,
  isPending,
  type = "text",
  autoComplete,
}: {
  name: TName;
  label: string;
  register: UseFormRegister<TFieldValues>;
  error?: FieldError;
  isPending: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        disabled={isPending}
        {...register(name)}
      />
      <FieldErrorMessage errors={error ? [error] : undefined} />
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
            <SelectTrigger id="status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {PARTNER_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <FieldErrorMessage errors={error ? [error] : undefined} />
    </Field>
  );
}

/**
 * Shared name/code/contact_email/status fields for both the create and
 * edit forms. `code` is the only field that differs by `mode`: a
 * registered, editable input in `"create"` mode, a disabled/read-only
 * input bound to a static value in `"edit"` mode — never registered into
 * the edit form, so there is no path for an edit submission to carry a
 * changed `code` even if the `disabled` attribute were somehow bypassed
 * client-side (see `partner.schema.ts`'s `updatePartnerSchema`, which has
 * no `code` field at all).
 */
export function PartnerForm(props: PartnerFormProps) {
  const { isPending } = props;

  if (props.mode === "create") {
    const { register, control, errors } = props;

    return (
      <FieldGroup>
        <TextField
          name="name"
          label="Name"
          register={register}
          error={errors.name}
          isPending={isPending}
          autoComplete="organization"
        />
        <TextField
          name="code"
          label="Code"
          register={register}
          error={errors.code}
          isPending={isPending}
        />
        <TextField
          name="contact_email"
          label="Contact email"
          register={register}
          error={errors.contact_email}
          isPending={isPending}
          type="email"
          autoComplete="email"
        />
        <StatusField control={control} error={errors.status} isPending={isPending} />
      </FieldGroup>
    );
  }

  const { register, control, errors, code } = props;

  return (
    <FieldGroup>
      <TextField
        name="name"
        label="Name"
        register={register}
        error={errors.name}
        isPending={isPending}
        autoComplete="organization"
      />
      <Field>
        <FieldLabel htmlFor="code">Code</FieldLabel>
        <Input id="code" value={code} disabled readOnly />
      </Field>
      <TextField
        name="contact_email"
        label="Contact email"
        register={register}
        error={errors.contact_email}
        isPending={isPending}
        type="email"
        autoComplete="email"
      />
      <StatusField control={control} error={errors.status} isPending={isPending} />
    </FieldGroup>
  );
}
