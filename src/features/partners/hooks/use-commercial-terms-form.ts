"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  saveCommercialTermsAction,
  type SaveCommercialTermsActionResult,
} from "@/features/partners/actions/save-commercial-terms.action";
import { dayAfter, platformShareOf } from "@/features/partners/lib/commercial-terms";
import {
  createCommercialTermsSchema,
  type CommercialTermsInput,
} from "@/features/partners/schemas/commercial-terms.schema";

interface UseCommercialTermsFormArgs {
  partnerId: string;
  /** The date of the server, so the form and the action agree on what "today" is. */
  today: string;
  defaultValues: CommercialTermsInput;
}

export function useCommercialTermsForm({ partnerId, today, defaultValues }: UseCommercialTermsFormArgs) {
  const form = useForm<CommercialTermsInput>({
    resolver: zodResolver(createCommercialTermsSchema(today)),
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SaveCommercialTermsActionResult | null>(null);

  const partnerShare = useWatch({ control: form.control, name: "partner_share_percent" });
  const platformShare = Number.isFinite(partnerShare) ? platformShareOf(partnerShare) : null;

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await saveCommercialTermsAction(partnerId, values);
      setResult(outcome);

      // The next change must start later than the terms just saved.
      if (outcome.success) {
        form.reset({ ...values, effective_from: dayAfter(values.effective_from) });
      }

      // A message that belongs to a field is shown under that field; the entered data is kept.
      if (!outcome.success && outcome.error?.field) {
        form.setError(outcome.error.field, { message: outcome.error.message });
      }
    });
  });

  return { form, onSubmit, isPending, result, platformShare };
}
