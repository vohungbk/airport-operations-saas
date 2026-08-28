"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSignupForm } from "@/features/auth/hooks/use-signup-form";

export function SignupForm() {
  const { form, onSubmit, isPending, result } = useSignupForm();
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
          <AlertTitle>Could not sign up</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <Field data-invalid={!!errors.full_name}>
          <FieldLabel htmlFor="full_name">Full name</FieldLabel>
          <Input
            id="full_name"
            autoComplete="name"
            aria-invalid={!!errors.full_name}
            disabled={isPending}
            {...register("full_name")}
          />
          <FieldError errors={errors.full_name ? [errors.full_name] : undefined} />
        </Field>

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

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
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
          <FieldLabel htmlFor="confirm_password">Confirm password</FieldLabel>
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
        {isPending ? "Creating account..." : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
          Sign in
        </Link>
      </p>
    </form>
  );
}
