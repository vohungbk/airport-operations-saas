"use client";

import { useUpdatePartnerBookingForm } from "@/features/bookings/hooks/use-update-partner-booking-form";
import { BookingForm } from "@/features/bookings/components/booking-form";
import { BookingFormLayout } from "@/features/bookings/components/booking-form-layout";
import { utcToZonedLocalInput } from "@/features/bookings/lib/booking-time";
import type { BookingDetailItem } from "@/features/bookings/lib/get-bookings";

interface EditPartnerBookingFormProps {
  booking: BookingDetailItem;
  /** The booking airport's timezone; the page 404s when the airport is unavailable. */
  timeZone: string;
}

/** The edit form of a partner user: schedule and details of a pending booking. */
export function EditPartnerBookingForm({
  booking,
  timeZone,
}: EditPartnerBookingFormProps) {
  const { form, onSubmit, isPending, result } = useUpdatePartnerBookingForm({
    bookingId: booking.id,
    defaultValues: {
      expected_updated_at: booking.updated_at,
      pickup_at: utcToZonedLocalInput(booking.pickup_at, timeZone),
      return_at: utcToZonedLocalInput(booking.return_at, timeZone),
      external_booking_number: booking.external_booking_number ?? "",
      child_age_band: booking.child_age_band ?? "",
      child_height:
        booking.child_height === null ? "" : String(booking.child_height),
      vehicle: booking.vehicle ?? "",
      vehicle_bay: booking.vehicle_bay ?? "",
      notes: booking.notes ?? "",
    },
  });
  const {
    register,
    control,
    formState: { errors, isDirty },
  } = form;

  return (
    <BookingFormLayout
      crumb={`${booking.booking_number} / Edit`}
      title="Edit booking"
      onSubmit={onSubmit}
      errors={errors}
      result={result}
      failureTitle="Could not update booking"
      isDirty={isDirty}
      isPending={isPending}
      submitLabel="Save"
      pendingLabel="Saving..."
      cancelHref={`/bookings/${booking.id}`}
      timeZone={timeZone}
    >
      <BookingForm
        mode="partner-edit"
        register={register}
        control={control}
        errors={errors}
        isPending={isPending}
        timeZone={timeZone}
        summary={{
          airport: booking.airport?.code ?? "-",
          category: booking.category?.name ?? "-",
        }}
      />
    </BookingFormLayout>
  );
}
