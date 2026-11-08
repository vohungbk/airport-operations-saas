"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { runClientAction } from "@/lib/actions/run-client-action";
import { zodResolver } from "@/lib/validation/zod-resolver";
import { saveBaselineInputsAction } from "@/features/roi/actions/save-baseline-inputs.action";
import type { BaselineValues } from "@/features/roi/lib/baseline-inputs";
import { NETWORK_ERROR, type BaselineInputsActionError } from "@/features/roi/lib/baseline-inputs-errors";
import { baselineInputsSchema } from "@/features/roi/schemas/baseline-inputs.schema";
import { PARTNER_ROI_ROUTE } from "@/lib/constants/routes";

/**
 * The form of the Baseline inputs screen (VI-F05-S05). It checks the entries with the schema of the action,
 * saves them, and goes back to the ROI dashboard when the save succeeds (NAV-3). A save that did not get
 * through leaves the form as it is, so the user keeps the entries and can try again (E7).
 */
export function useBaselineInputsForm(defaultValues?: Partial<BaselineValues>) {
  const router = useRouter();
  const form = useForm<BaselineValues>({ resolver: zodResolver(baselineInputsSchema), defaultValues });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<BaselineInputsActionError | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const outcome = await runClientAction(() => saveBaselineInputsAction(values), NETWORK_ERROR);

      if (outcome.success) router.push(PARTNER_ROI_ROUTE);
      else setError(outcome.error);
    });
  });

  return { form, onSubmit, isPending, error };
}
