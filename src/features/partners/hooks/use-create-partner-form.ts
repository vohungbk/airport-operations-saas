"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  createPartnerAction,
  type CreatePartnerActionResult,
} from "@/features/partners/actions/create-partner.action";
import {
  createPartnerSchema,
  type CreatePartnerInput,
} from "@/features/partners/schemas/partner.schema";

export function useCreatePartnerForm() {
  const form = useForm<CreatePartnerInput>({
    resolver: zodResolver(createPartnerSchema),
    defaultValues: {
      name: "",
      code: "",
      contact_email: "",
      status: "pending",
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<CreatePartnerActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await createPartnerAction(values));
    });
  });

  return { form, onSubmit, isPending, result };
}
