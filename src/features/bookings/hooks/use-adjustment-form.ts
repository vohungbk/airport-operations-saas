"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { toast } from "@/components/ui/toast";
import { runClientAction } from "@/lib/actions/run-client-action";
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
  /** Called after the adjustment was recorded: the dialog closes. */
  onSuccess: () => void;
}

export function useAdjustmentForm({ bookingId, maxAmount, onSuccess }: UseAdjustmentFormArgs) {
  const form = useForm<AdjustmentInput>({
    resolver: zodResolver(createAdjustmentSchema(maxAmount)),
    defaultValues: { type: undefined, amount: undefined, reason: "" },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AdjustmentActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      // A call that did not get through leaves the form as it is, so the user can try again.
      const outcome: AdjustmentActionResult = await runClientAction(
        () => recordAdjustmentAction(bookingId, values),
        NETWORK_ERROR,
      );

      setResult(outcome);

      if (outcome.success) {
        toast("Adjustment recorded", "success");
        form.reset();
        onSuccess();
        return;
      }

      // A message that belongs to a field is shown under that field; the entries are kept.
      if (outcome.error?.field) {
        form.setError(outcome.error.field, { message: outcome.error.message });
      }
    });
  });

  return { form, onSubmit, isPending, result };
}
