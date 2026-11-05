"use client";

import { Controller } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";
import { useSignupForm } from "@/features/auth/hooks/use-signup-form";
import {
  AUTH_CONTROL_CLASS,
  AUTH_FIELD_CLASS,
  AUTH_HINT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AUTH_SUBMIT_CLASS,
} from "@/features/auth/lib/auth-form-styles";

export function SignupForm() {
  const { form, onSubmit, isPending, result } = useSignupForm();
  const {
    register,
    control,
    formState: { errors },
  } = form;

  if (result?.success) {
    return (
      <Alert>
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not sign up</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.full_name} className={AUTH_FIELD_CLASS}>
          <FieldLabel htmlFor="full_name" className={AUTH_LABEL_CLASS}>
            Full name <span aria-hidden="true">*</span>
          </FieldLabel>
          <Input
            id="full_name"
            autoComplete="name"
            aria-required="true"
            aria-invalid={!!errors.full_name}
            disabled={isPending}
            className={AUTH_CONTROL_CLASS}
            {...register("full_name")}
          />
          <FieldError errors={errors.full_name ? [errors.full_name] : undefined} />
        </Field>

        <Field data-invalid={!!errors.email} className={AUTH_FIELD_CLASS}>
          <FieldLabel htmlFor="email" className={AUTH_LABEL_CLASS}>
            Work email <span aria-hidden="true">*</span>
          </FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-required="true"
            aria-invalid={!!errors.email}
            disabled={isPending}
            className={AUTH_CONTROL_CLASS}
            {...register("email")}
          />
          <FieldError errors={errors.email ? [errors.email] : undefined} />
        </Field>

        <Field data-invalid={!!errors.password} className={AUTH_FIELD_CLASS}>
          <FieldLabel htmlFor="password" className={AUTH_LABEL_CLASS}>
            Password <span aria-hidden="true">*</span>
          </FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-required="true"
            aria-invalid={!!errors.password}
            aria-describedby="password-hint"
            disabled={isPending}
            className={AUTH_CONTROL_CLASS}
            {...register("password")}
          />
          <FieldDescription id="password-hint" className={AUTH_HINT_CLASS}>
            At least 12 characters, including a number and symbol.
          </FieldDescription>
          <FieldError errors={errors.password ? [errors.password] : undefined} />
        </Field>

        <Field
          data-invalid={!!errors.confirm_password}
          className={AUTH_FIELD_CLASS}
        >
          <FieldLabel htmlFor="confirm_password" className={AUTH_LABEL_CLASS}>
            Confirm password <span aria-hidden="true">*</span>
          </FieldLabel>
          <Input
            id="confirm_password"
            type="password"
            autoComplete="new-password"
            aria-required="true"
            aria-invalid={!!errors.confirm_password}
            disabled={isPending}
            className={AUTH_CONTROL_CLASS}
            {...register("confirm_password")}
          />
          <FieldError
            errors={errors.confirm_password ? [errors.confirm_password] : undefined}
          />
        </Field>

        <Field data-invalid={!!errors.accepted_terms} className={AUTH_FIELD_CLASS}>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="accepted_terms"
              render={({ field }) => (
                <Checkbox
                  id="accepted_terms"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked)}
                  onBlur={field.onBlur}
                  aria-required="true"
                  aria-invalid={!!errors.accepted_terms}
                  disabled={isPending}
                />
              )}
            />
            <FieldLabel htmlFor="accepted_terms" className={AUTH_HINT_CLASS}>
              I agree to the Terms of Service and Privacy Policy.
            </FieldLabel>
          </div>
          <FieldError
            errors={errors.accepted_terms ? [errors.accepted_terms] : undefined}
          />
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={isPending} className={AUTH_SUBMIT_CLASS}>
        {isPending ? "Creating account..." : "Create account"}
      </Button>

      <p className="flex flex-wrap items-center gap-x-1 text-body text-text-muted">
        Already have an account?
        <TextLink href="/login" className={AUTH_LINK_CLASS}>
          Sign in
        </TextLink>
      </p>
    </form>
  );
}
