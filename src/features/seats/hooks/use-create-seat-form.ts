"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  createSeatAction,
  type CreateSeatActionResult,
} from "@/features/seats/actions/create-seat.action";
import {
  createSeatSchema,
  type CreateSeatInput,
} from "@/features/seats/schemas/seat.schema";

export function useCreateSeatForm() {
  const form = useForm<CreateSeatInput>({
    resolver: zodResolver(createSeatSchema),
    defaultValues: {
      serial_number: "",
      manufacturer: "",
      model: "",
      manufacture_date: "",
      purchase_date: "",
      category_id: "",
      airport_id: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<CreateSeatActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await createSeatAction(values));
    });
  });

  return { form, onSubmit, isPending, result };
}
