"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { recordAdjustmentAction } from "@/features/bookings/actions/record-adjustment.action";
import {
  NETWORK_ERROR,
  type AdjustmentActionResult,
} from "@/features/bookings/lib/adjustment-errors";
import {
  createAdjustmentSchema,
  type AdjustmentInput,
} from "@/features/bookings/schemas/adjustment.schema";

interface UseAdjustmentFormArgs {
  bookingId: string;
  /** The gross revenue the booking has now: the most an adjustment can be. */
  maxAmount: number;
}

/**
 * Next signals `redirect()` / `notFound()` by throwing an error whose digest starts with `NEXT_`. It
 * must reach the framework untouched, or a successful save would look like a failure.
 */
function isFrameworkSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;

  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export function useAdjustmentForm({ bookingId, maxAmount }: UseAdjustmentFormArgs) {
  const form = useForm<AdjustmentInput>({
    resolver: zodResolver(createAdjustmentSchema(maxAmount)),
    defaultValues: { type: undefined, amount: undefined, reason: "" },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AdjustmentActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      let outcome: AdjustmentActionResult;

      try {
        outcome = await recordAdjustmentAction(bookingId, values);
      } catch (error) {
        if (isFrameworkSignal(error)) {
          throw error;
        }
        // The call did not get through: the form stays as it is, so the user can try again.
        outcome = { success: false, error: NETWORK_ERROR };
      }

      setResult(outcome);

      // A message that belongs to a field is shown under that field; the entries are kept.
      if (!outcome.success && outcome.error?.field) {
        form.setError(outcome.error.field, { message: outcome.error.message });
      }
    });
  });

  return { form, onSubmit, isPending, result };
}
