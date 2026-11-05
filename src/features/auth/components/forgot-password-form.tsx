"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";
import { useForgotPasswordForm } from "@/features/auth/hooks/use-forgot-password-form";
import {
  AUTH_CONTROL_CLASS,
  AUTH_FIELD_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AUTH_SUBMIT_CLASS,
} from "@/features/auth/lib/auth-form-styles";

export function ForgotPasswordForm() {
  const { form, onSubmit, isPending, result } = useForgotPasswordForm();
  const {
    register,
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
          <AlertTitle>Could not send reset link</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.email} className={AUTH_FIELD_CLASS}>
          <FieldLabel htmlFor="email" className={AUTH_LABEL_CLASS}>
            Email address <span aria-hidden="true">*</span>
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
      </FieldGroup>

      <Button type="submit" disabled={isPending} className={AUTH_SUBMIT_CLASS}>
        {isPending ? "Sending..." : "Send reset link"}
      </Button>

      <div className="flex text-body text-text-muted">
        <TextLink href="/login" className={AUTH_LINK_CLASS}>
          Back to sign in
        </TextLink>
      </div>
    </form>
  );
}
