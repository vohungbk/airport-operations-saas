"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  createAirportAction,
  type CreateAirportActionResult,
} from "@/features/airports/actions/create-airport.action";
import {
  createAirportSchema,
  type CreateAirportInput,
} from "@/features/airports/schemas/airport.schema";

export function useCreateAirportForm() {
  const form = useForm<CreateAirportInput>({
    resolver: zodResolver(createAirportSchema),
    defaultValues: {
      code: "",
      name: "",
      city: "",
      country: "",
      timezone: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<CreateAirportActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await createAirportAction(values));
    });
  });

  return { form, onSubmit, isPending, result };
}
