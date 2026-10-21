"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { createPartnerBookingAction } from "@/features/bookings/actions/create-partner-booking.action";
import type { BookingActionResult } from "@/features/bookings/lib/booking-errors";
import { runBookingAction } from "@/features/bookings/lib/run-booking-action";
import {
  createPartnerBookingSchema,
  type CreatePartnerBookingInput,
} from "@/features/bookings/schemas/booking.schema";

export function useCreatePartnerBookingForm(
  airportTimezones: Record<string, string>,
) {
  const form = useForm<CreatePartnerBookingInput>({
    resolver: zodResolver(createPartnerBookingSchema),
    defaultValues: {
      airport_id: "",
      seat_category_id: "",
      daily_rate: "",
      pickup_at: "",
      return_at: "",
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

  const airportId = useWatch({ control: form.control, name: "airport_id" });
  const timeZone = airportTimezones[airportId] ?? null;

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(
        await runBookingAction(() => createPartnerBookingAction(values)),
      );
    });
  });

  return { form, onSubmit, isPending, result, timeZone };
}
