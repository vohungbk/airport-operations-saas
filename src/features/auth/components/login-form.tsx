"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useLoginForm } from "@/features/auth/hooks/use-login-form";

export function LoginForm() {
  const { form, onSubmit, isPending, formError } = useLoginForm();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError && (
        <Alert variant="destructive">
          <AlertTitle>Could not sign in</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
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

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            disabled={isPending}
            {...register("password")}
          />
          <FieldError errors={errors.password ? [errors.password] : undefined} />
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Signing in..." : "Sign in"}
      </Button>

      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <Link href="/forgot-password" className="underline underline-offset-4 hover:text-foreground">
          Forgot your password?
        </Link>
        <p>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline underline-offset-4 hover:text-foreground">
            Sign up
          </Link>
        </p>
      </div>
    </form>
  );
}
