"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCreateAirportForm } from "@/features/airports/hooks/use-create-airport-form";
import { AirportForm } from "@/features/airports/components/airport-form";

export function CreateAirportForm() {
  const { form, onSubmit, isPending, result } = useCreateAirportForm();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not create airport</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <AirportForm
        mode="create"
        register={register}
        errors={errors}
        isPending={isPending}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create airport"}
        </Button>
        <Link href="/airports" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
