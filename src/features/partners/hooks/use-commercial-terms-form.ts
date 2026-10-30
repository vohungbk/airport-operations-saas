"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { runClientAction } from "@/lib/actions/run-client-action";
import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  saveCommercialTermsAction,
  type SaveCommercialTermsActionResult,
} from "@/features/partners/actions/save-commercial-terms.action";
import { NETWORK_ERROR } from "@/features/partners/lib/commercial-terms-errors";
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
      // A call that did not get through leaves the form as it is, so the user can try again (E10).
      const outcome: SaveCommercialTermsActionResult = await runClientAction(
        () => saveCommercialTermsAction(partnerId, values),
        NETWORK_ERROR,
      );
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
