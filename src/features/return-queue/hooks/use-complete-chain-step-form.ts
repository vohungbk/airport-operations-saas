"use client";

import { useCallback, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { runClientAction } from "@/lib/actions/run-client-action";
import { zodResolver } from "@/lib/validation/zod-resolver";
import { completeChainStepAction } from "@/features/return-queue/actions/complete-chain-step.action";
import {
  CHAIN_STEP_NETWORK_ERROR,
  type ChainStepActionResult,
} from "@/features/return-queue/lib/chain-step-errors";
import type { RecordedChainStep } from "@/features/return-queue/lib/return-chain";
import {
  completeChainStepSchema,
  type CompleteChainStepInput,
} from "@/features/return-queue/schemas/complete-chain-step.schema";

/**
 * The Complete step form. A failed save keeps every entry on screen so the
 * user can try again (E8); a successful one is redirected to the Return queue
 * by the action.
 */
export function useCompleteChainStepForm(bookingId: string, step: RecordedChainStep) {
  const form = useForm<CompleteChainStepInput>({
    resolver: zodResolver(completeChainStepSchema),
    // No default result: the user has to choose one.
    defaultValues: {
      booking_id: bookingId,
      step,
      checklist: {},
      notes: "",
      photo_paths: [],
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ChainStepActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await runClientAction(
        () => completeChainStepAction(values),
        CHAIN_STEP_NETWORK_ERROR,
      );

      // A refused photo is shown at the photo field, not in the page alert (E5).
      if (!outcome.success && outcome.error.code === "PHOTO_REQUIRED") {
        form.setError("photo_paths", { type: "server", message: outcome.error.message });

        return;
      }

      setResult(outcome);
    });
  });

  const { setValue, formState } = form;
  const setPhotoPaths = useCallback(
    (paths: string[]) =>
      setValue("photo_paths", paths, { shouldValidate: formState.isSubmitted }),
    [setValue, formState.isSubmitted],
  );

  return { form, onSubmit, isPending, result, setPhotoPaths };
}
