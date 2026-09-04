"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  updatePartnerAction,
  type UpdatePartnerActionResult,
} from "@/features/partners/actions/update-partner.action";
import {
  updatePartnerSchema,
  type UpdatePartnerInput,
} from "@/features/partners/schemas/partner.schema";

interface UseUpdatePartnerFormArgs {
  partnerId: string;
  defaultValues: UpdatePartnerInput;
}

export function useUpdatePartnerForm({
  partnerId,
  defaultValues,
}: UseUpdatePartnerFormArgs) {
  const form = useForm<UpdatePartnerInput>({
    resolver: zodResolver(updatePartnerSchema),
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<UpdatePartnerActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await updatePartnerAction(partnerId, values));
    });
  });

  return { form, onSubmit, isPending, result };
}
