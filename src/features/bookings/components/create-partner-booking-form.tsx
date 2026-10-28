"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCreatePartnerBookingForm } from "@/features/bookings/hooks/use-create-partner-booking-form";
import { BookingForm } from "@/features/bookings/components/booking-form";
import type { PartnerBookingFormOptions } from "@/features/bookings/lib/get-booking-form-options";

interface CreatePartnerBookingFormProps {
  options: PartnerBookingFormOptions;
}

/** The create form of a partner user: no partner and no seat to choose. */
export function CreatePartnerBookingForm({
  options,
}: CreatePartnerBookingFormProps) {
  const { form, onSubmit, isPending, result, timeZone } =
    useCreatePartnerBookingForm(options.airport_timezones);
  const {
    register,
    control,
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
        mode="partner-create"
        register={register}
        control={control}
        errors={errors}
        isPending={isPending}
        options={options}
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
