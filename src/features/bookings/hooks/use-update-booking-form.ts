"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { updateBookingAction } from "@/features/bookings/actions/update-booking.action";
import type { BookingActionResult } from "@/features/bookings/lib/booking-errors";
import { useAvailableSeats } from "@/features/bookings/hooks/use-available-seats";
import {
  updateBookingSchema,
  type UpdateBookingInput,
} from "@/features/bookings/schemas/booking.schema";

interface UseUpdateBookingFormArgs {
  bookingId: string;
  airportId: string;
  seatCategoryId: string;
  defaultValues: UpdateBookingInput;
}

export function useUpdateBookingForm({
  bookingId,
  airportId,
  seatCategoryId,
  defaultValues,
}: UseUpdateBookingFormArgs) {
  const form = useForm<UpdateBookingInput>({
    resolver: zodResolver(updateBookingSchema),
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BookingActionResult | null>(null);

  const [pickupAt, returnAt] = useWatch({
    control: form.control,
    name: ["pickup_at", "return_at"],
  });
  const availableSeats = useAvailableSeats({
    airportId,
    seatCategoryId,
    pickupAt,
    returnAt,
    excludeBookingId: bookingId,
  });

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await updateBookingAction(bookingId, values));
    });
  });

  return { form, onSubmit, isPending, result, availableSeats };
}
