"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useForgotPasswordForm } from "@/features/auth/hooks/use-forgot-password-form";

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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not send reset link</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            disabled={isPending}
            {...register("email")}
          />
          <FieldError errors={errors.email ? [errors.email] : undefined} />
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Sending..." : "Send reset link"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
