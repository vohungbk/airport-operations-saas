"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCreateBookingForm } from "@/features/bookings/hooks/use-create-booking-form";
import { BookingForm } from "@/features/bookings/components/booking-form";
import type { BookingFormOptions } from "@/features/bookings/lib/get-booking-form-options";

interface CreateBookingFormProps {
  options: BookingFormOptions;
}

export function CreateBookingForm({ options }: CreateBookingFormProps) {
  const { form, onSubmit, isPending, result, availableSeats, timeZone } =
    useCreateBookingForm(options.airport_timezones);
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not create booking</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <BookingForm
        mode="create"
        register={register}
        errors={errors}
        isPending={isPending}
        options={options}
        availableSeats={availableSeats}
        timeZone={timeZone}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create booking"}
        </Button>
        <Link
          href="/bookings"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
