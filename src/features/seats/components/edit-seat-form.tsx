"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useUpdateSeatForm } from "@/features/seats/hooks/use-update-seat-form";
import { SeatForm } from "@/features/seats/components/seat-form";
import type { SeatFormOptions } from "@/features/seats/lib/get-seat-form-options";
import type { Seat } from "@/features/seats/types";

interface EditSeatFormProps {
  seat: Seat;
  options: SeatFormOptions;
}

export function EditSeatForm({ seat, options }: EditSeatFormProps) {
  const { form, onSubmit, isPending, result } = useUpdateSeatForm({
    seatId: seat.id,
    rentalCycles: seat.rental_cycles,
    defaultValues: {
      manufacturer: seat.manufacturer,
      model: seat.model,
      manufacture_date: seat.manufacture_date,
      purchase_date: seat.purchase_date,
      max_rental_cycles: seat.max_rental_cycles,
      category_id: seat.category_id,
      airport_id: seat.airport_id,
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
          <AlertTitle>Could not update seat</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <SeatForm
        mode="edit"
        register={register}
        errors={errors}
        isPending={isPending}
        options={options}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
        <Link
          href={`/seats/${seat.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
