"use client";

import type {
  FieldError,
  FieldValues,
  Path,
  UseFormRegister,
} from "react-hook-form";

import { Field, FieldError as FieldErrorMessage, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type {
  CreateAirportInput,
  UpdateAirportInput,
} from "@/features/airports/schemas/airport.schema";

type CreateModeProps = {
  mode: "create";
  register: UseFormRegister<CreateAirportInput>;
  errors: {
    code?: FieldError;
    name?: FieldError;
    city?: FieldError;
    country?: FieldError;
    timezone?: FieldError;
  };
  isPending: boolean;
};

type EditModeProps = {
  mode: "edit";
  register: UseFormRegister<UpdateAirportInput>;
  errors: {
    name?: FieldError;
    city?: FieldError;
    country?: FieldError;
    timezone?: FieldError;
  };
  isPending: boolean;
  /** Existing `code`, shown read-only — `code` is immutable after creation. */
  code: string;
};

type AirportFormProps = CreateModeProps | EditModeProps;

/**
 * Generic text field shared by both modes. Its own `TFieldValues`/`TName`
 * type parameters are inferred fresh at each call site, so a call made
 * from inside the already-narrowed `"create"` or `"edit"` branch below
 * type-checks against that branch's own `register`/schema shape — this
 * is what lets one implementation serve both forms without a cast.
 * Mirrors `partner-form.tsx`'s `TextField`.
 */
function TextField<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>({
  name,
  label,
  register,
  error,
  isPending,
  placeholder,
}: {
  name: TName;
  label: string;
  register: UseFormRegister<TFieldValues>;
  error?: FieldError;
  isPending: boolean;
  placeholder?: string;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        type="text"
        placeholder={placeholder}
        aria-invalid={!!error}
        disabled={isPending}
        {...register(name)}
      />
      <FieldErrorMessage errors={error ? [error] : undefined} />
    </Field>
  );
}

/**
 * Shared code/name/city/country/timezone fields for both the create and
 * edit forms. `code` is the only field that differs by `mode`: a
 * registered, editable input in `"create"` mode, a disabled/read-only
 * input bound to a static value in `"edit"` mode — never registered into
 * the edit form, so there is no path for an edit submission to carry a
 * changed `code` even if the `disabled` attribute were somehow bypassed
 * client-side (see `airport.schema.ts`'s `updateAirportSchema`, which has
 * no `code` field at all). `timezone` is a plain text input with an
 * example placeholder, not a combobox — no new dependency, per plan.md
 * Task 13.
 */
export function AirportForm(props: AirportFormProps) {
  const { isPending } = props;

  if (props.mode === "create") {
    const { register, errors } = props;

    return (
      <FieldGroup>
        <TextField
          name="code"
          label="Code"
          register={register}
          error={errors.code}
          isPending={isPending}
          placeholder="e.g. DXB"
        />
        <TextField
          name="name"
          label="Name"
          register={register}
          error={errors.name}
          isPending={isPending}
        />
        <TextField
          name="city"
          label="City"
          register={register}
          error={errors.city}
          isPending={isPending}
        />
        <TextField
          name="country"
          label="Country"
          register={register}
          error={errors.country}
          isPending={isPending}
        />
        <TextField
          name="timezone"
          label="Timezone"
          register={register}
          error={errors.timezone}
          isPending={isPending}
          placeholder="e.g. Asia/Dubai"
        />
      </FieldGroup>
    );
  }

  const { register, errors, code } = props;

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="code">Code</FieldLabel>
        <Input id="code" value={code} disabled readOnly />
      </Field>
      <TextField
        name="name"
        label="Name"
        register={register}
        error={errors.name}
        isPending={isPending}
      />
      <TextField
        name="city"
        label="City"
        register={register}
        error={errors.city}
        isPending={isPending}
      />
      <TextField
        name="country"
        label="Country"
        register={register}
        error={errors.country}
        isPending={isPending}
      />
      <TextField
        name="timezone"
        label="Timezone"
        register={register}
        error={errors.timezone}
        isPending={isPending}
        placeholder="e.g. Asia/Dubai"
      />
    </FieldGroup>
  );
}
