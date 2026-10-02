"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { createBookingAction } from "@/features/bookings/actions/create-booking.action";
import type { BookingActionResult } from "@/features/bookings/lib/booking-errors";
import { useAvailableSeats } from "@/features/bookings/hooks/use-available-seats";
import {
  createBookingSchema,
  type CreateBookingInput,
} from "@/features/bookings/schemas/booking.schema";

export function useCreateBookingForm(airportTimezones: Record<string, string>) {
  const form = useForm<CreateBookingInput>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: {
      partner_id: "",
      airport_id: "",
      seat_category_id: "",
      daily_rate: "",
      pickup_at: "",
      return_at: "",
      assigned_seat_id: "",
      external_booking_number: "",
      child_age_band: "",
      child_height: "",
      vehicle: "",
      vehicle_bay: "",
      notes: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BookingActionResult | null>(null);

  const [airportId, seatCategoryId, pickupAt, returnAt] = useWatch({
    control: form.control,
    name: ["airport_id", "seat_category_id", "pickup_at", "return_at"],
  });
  const availableSeats = useAvailableSeats({
    airportId,
    seatCategoryId,
    pickupAt,
    returnAt,
  });
  const timeZone = airportTimezones[airportId] ?? null;

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await createBookingAction(values));
    });
  });

  return { form, onSubmit, isPending, result, availableSeats, timeZone };
}
