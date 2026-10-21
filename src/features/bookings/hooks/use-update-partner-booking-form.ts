"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { updatePartnerBookingAction } from "@/features/bookings/actions/update-partner-booking.action";
import type { BookingActionResult } from "@/features/bookings/lib/booking-errors";
import {
  updatePartnerBookingSchema,
  type UpdatePartnerBookingInput,
} from "@/features/bookings/schemas/booking.schema";

interface UseUpdatePartnerBookingFormArgs {
  bookingId: string;
  defaultValues: UpdatePartnerBookingInput;
}

export function useUpdatePartnerBookingForm({
  bookingId,
  defaultValues,
}: UseUpdatePartnerBookingFormArgs) {
  const form = useForm<UpdatePartnerBookingInput>({
    resolver: zodResolver(updatePartnerBookingSchema),
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BookingActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await updatePartnerBookingAction(bookingId, values));
    });
  });

  return { form, onSubmit, isPending, result };
}
