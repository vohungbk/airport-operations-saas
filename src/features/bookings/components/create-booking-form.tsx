"use client";

import { useCreateBookingForm } from "@/features/bookings/hooks/use-create-booking-form";
import { BookingForm } from "@/features/bookings/components/booking-form";
import { BookingFormLayout } from "@/features/bookings/components/booking-form-layout";
import type { BookingFormOptions } from "@/features/bookings/lib/get-booking-form-options";

interface CreateBookingFormProps {
  options: BookingFormOptions;
}

export function CreateBookingForm({ options }: CreateBookingFormProps) {
  const { form, onSubmit, isPending, result, availableSeats, timeZone } =
    useCreateBookingForm(options.airport_timezones);
  const {
    register,
    control,
    formState: { errors, isDirty },
  } = form;
  const categoryId = form.watch("seat_category_id");
  const categoryName =
    options.categories.find((category) => category.value === categoryId)
      ?.label ?? null;

  return (
    <BookingFormLayout
      crumb="Create"
      title="Create booking"
      onSubmit={onSubmit}
      errors={errors}
      result={result}
      failureTitle="Could not create booking"
      isDirty={isDirty}
      isPending={isPending}
      submitLabel="Create booking"
      pendingLabel="Creating..."
      cancelHref="/bookings"
      timeZone={timeZone}
    >
      <BookingForm
        mode="create"
        register={register}
        control={control}
        errors={errors}
        isPending={isPending}
        options={options}
        availableSeats={availableSeats}
        timeZone={timeZone}
        categoryName={categoryName}
      />
    </BookingFormLayout>
  );
}
