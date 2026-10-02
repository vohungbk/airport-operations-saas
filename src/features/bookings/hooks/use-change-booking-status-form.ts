"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { changeBookingStatusAction } from "@/features/bookings/actions/change-booking-status.action";
import type { BookingActionResult } from "@/features/bookings/lib/booking-errors";
import {
  changeBookingStatusSchema,
  type ChangeBookingStatusInput,
} from "@/features/bookings/schemas/booking.schema";

interface UseChangeBookingStatusFormArgs {
  bookingId: string;
  defaultStatus: ChangeBookingStatusInput["to_status"];
  onSuccess: () => void;
}

export function useChangeBookingStatusForm({
  bookingId,
  defaultStatus,
  onSuccess,
}: UseChangeBookingStatusFormArgs) {
  const router = useRouter();
  const form = useForm<ChangeBookingStatusInput>({
    resolver: zodResolver(changeBookingStatusSchema),
    defaultValues: {
      booking_id: bookingId,
      to_status: defaultStatus,
      reason: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BookingActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const next = await changeBookingStatusAction(values);
      setResult(next);

      if (next.success) {
        onSuccess();
        // Re-runs the Server Component fetch so status and timeline cannot go stale.
        router.refresh();
      }
    });
  });

  function reset() {
    setResult(null);
    form.reset();
  }

  return { form, onSubmit, isPending, result, reset };
}
