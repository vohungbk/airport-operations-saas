"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";
import { useLoginForm } from "@/features/auth/hooks/use-login-form";
import {
  AUTH_CONTROL_CLASS,
  AUTH_FIELD_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AUTH_SUBMIT_CLASS,
} from "@/features/auth/lib/auth-form-styles";

interface LoginFormProps {
  /** The page to return to after signing in, already checked by the page. */
  next?: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const { form, onSubmit, isPending, formError } = useLoginForm(next);
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && (
        <Alert variant="destructive">
          <AlertTitle>Could not sign in</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
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

        <Field data-invalid={!!errors.password} className={AUTH_FIELD_CLASS}>
          <FieldLabel htmlFor="password" className={AUTH_LABEL_CLASS}>
            Password <span aria-hidden="true">*</span>
          </FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-required="true"
            aria-invalid={!!errors.password}
            disabled={isPending}
            className={AUTH_CONTROL_CLASS}
            {...register("password")}
          />
          <FieldError errors={errors.password ? [errors.password] : undefined} />
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={isPending} className={AUTH_SUBMIT_CLASS}>
        {isPending ? "Signing in..." : "Sign in"}
      </Button>

      <div className="flex flex-wrap items-center gap-x-3 text-body text-text-muted">
        <TextLink href="/forgot-password" className={AUTH_LINK_CLASS}>
          Forgot password?
        </TextLink>
        <span aria-hidden="true">·</span>
        <TextLink href="/signup" className={AUTH_LINK_CLASS}>
          Create an account
        </TextLink>
      </div>
    </form>
  );
}
