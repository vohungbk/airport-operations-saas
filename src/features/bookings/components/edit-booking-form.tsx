"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useUpdateBookingForm } from "@/features/bookings/hooks/use-update-booking-form";
import { BookingForm } from "@/features/bookings/components/booking-form";
import { utcToZonedLocalInput } from "@/features/bookings/lib/booking-time";
import type { BookingDetailItem } from "@/features/bookings/lib/get-bookings";

interface EditBookingFormProps {
  booking: BookingDetailItem;
  /** The booking airport's timezone; the page 404s when the airport is unavailable. */
  timeZone: string;
}

export function EditBookingForm({ booking, timeZone }: EditBookingFormProps) {
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
        notes: booking.notes ?? "",
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
          <AlertTitle>Could not update booking</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Partner</dt>
          <dd>{booking.partner?.name ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Airport</dt>
          <dd>{booking.airport?.code ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Seat category</dt>
          <dd>{booking.category?.name ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Daily rate</dt>
          <dd>{booking.daily_rate.toFixed(2)}</dd>
        </div>
      </dl>

      <BookingForm
        mode="edit"
        register={register}
        errors={errors}
        isPending={isPending}
        availableSeats={availableSeats}
        timeZone={timeZone}
        currentSeat={booking.seat}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
        <Link
          href={`/bookings/${booking.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
