"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useUpdateAirportForm } from "@/features/airports/hooks/use-update-airport-form";
import { AirportForm } from "@/features/airports/components/airport-form";
import type { Airport } from "@/features/airports/types";

interface EditAirportFormProps {
  airport: Airport;
}

export function EditAirportForm({ airport }: EditAirportFormProps) {
  const { form, onSubmit, isPending, result } = useUpdateAirportForm({
    airportId: airport.id,
    defaultValues: {
      name: airport.name,
      city: airport.city,
      country: airport.country,
      timezone: airport.timezone,
    },
  });
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not update airport</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <AirportForm
        mode="edit"
        register={register}
        errors={errors}
        isPending={isPending}
        code={airport.code}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
        <Link
          href={`/airports/${airport.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
