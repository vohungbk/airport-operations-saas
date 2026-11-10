"use client";

import { useCreatePartnerBookingForm } from "@/features/bookings/hooks/use-create-partner-booking-form";
import { BookingForm } from "@/features/bookings/components/booking-form";
import { BookingFormLayout } from "@/features/bookings/components/booking-form-layout";
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
    formState: { errors, isDirty },
  } = form;

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
        mode="partner-create"
        register={register}
        control={control}
        errors={errors}
        isPending={isPending}
        options={options}
        timeZone={timeZone}
      />
    </BookingFormLayout>
  );
}
