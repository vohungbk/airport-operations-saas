"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useResetPasswordForm } from "@/features/auth/hooks/use-reset-password-form";

export function ResetPasswordForm() {
  const { form, onSubmit, isPending, formError } = useResetPasswordForm();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError && (
        <Alert variant="destructive">
          <AlertTitle>Could not reset password</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            disabled={isPending}
            {...register("password")}
          />
          <FieldError errors={errors.password ? [errors.password] : undefined} />
        </Field>

        <Field data-invalid={!!errors.confirm_password}>
          <FieldLabel htmlFor="confirm_password">Confirm new password</FieldLabel>
          <Input
            id="confirm_password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirm_password}
            disabled={isPending}
            {...register("confirm_password")}
          />
          <FieldError
            errors={errors.confirm_password ? [errors.confirm_password] : undefined}
          />
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
