"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { runClientAction } from "@/lib/actions/run-client-action";
import { zodResolver } from "@/lib/validation/zod-resolver";
import { generateSettlementAction } from "@/features/settlements/actions/generate-settlement.action";
import {
  NETWORK_ERROR,
  type SettlementActionResult,
} from "@/features/settlements/lib/settlement-errors";
import {
  createGenerateSettlementSchema,
  type GenerateSettlementInput,
} from "@/features/settlements/schemas/settlement.schema";

export function useGenerateSettlementForm() {
  const form = useForm<GenerateSettlementInput>({
    resolver: zodResolver(createGenerateSettlementSchema()),
    defaultValues: { partner_id: undefined, month: "" },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SettlementActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const outcome: SettlementActionResult = await runClientAction(
        () => generateSettlementAction(values),
        NETWORK_ERROR,
      );

      setResult(outcome);

      // A message that belongs to a field is shown under that field; the entries are kept.
      if (!outcome.success && outcome.error?.field) {
        form.setError(outcome.error.field, { message: outcome.error.message });
      }
    });
  });

  return { form, onSubmit, isPending, result };
}
