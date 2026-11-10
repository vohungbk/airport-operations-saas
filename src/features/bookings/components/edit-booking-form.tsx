"use client";

import { useUpdateBookingForm } from "@/features/bookings/hooks/use-update-booking-form";
import { BookingForm } from "@/features/bookings/components/booking-form";
import { BookingFormLayout } from "@/features/bookings/components/booking-form-layout";
import { utcToZonedLocalInput } from "@/features/bookings/lib/booking-time";
import type { BookingDetailItem } from "@/features/bookings/lib/get-bookings";

interface EditBookingFormProps {
  booking: BookingDetailItem;
  /** The booking airport's timezone; the page 404s when the airport is unavailable. */
  timeZone: string;
  /** The pickup time has passed: pickup and seat are read only. */
  pickupLocked: boolean;
}

export function EditBookingForm({
  booking,
  timeZone,
  pickupLocked,
}: EditBookingFormProps) {
  const { form, onSubmit, isPending, result, availableSeats } =
    useUpdateBookingForm({
      bookingId: booking.id,
      airportId: booking.airport_id,
      seatCategoryId: booking.seat_category_id,
      defaultValues: {
        expected_updated_at: booking.updated_at,
        pickup_at: utcToZonedLocalInput(booking.pickup_at, timeZone),
        return_at: utcToZonedLocalInput(booking.return_at, timeZone),
        assigned_seat_id: booking.assigned_seat_id ?? "",
        external_booking_number: booking.external_booking_number ?? "",
        child_age_band: booking.child_age_band ?? "",
        child_height:
          booking.child_height === null ? "" : String(booking.child_height),
        vehicle: booking.vehicle ?? "",
        vehicle_bay: booking.vehicle_bay ?? "",
        flight_number: booking.flight_number ?? "",
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
        mode="edit"
        register={register}
        control={control}
        errors={errors}
        isPending={isPending}
        availableSeats={availableSeats}
        timeZone={timeZone}
        currentSeat={booking.seat}
        pickupLocked={pickupLocked}
        summary={{
          partner: booking.partner?.name ?? "-",
          airport: booking.airport?.code ?? "-",
          category: booking.category?.name ?? "-",
          daily_rate: booking.daily_rate.toFixed(2),
        }}
      />
    </BookingFormLayout>
  );
}
