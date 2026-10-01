"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  createSeatCategoryAction,
  type CreateSeatCategoryActionResult,
} from "@/features/seat-categories/actions/create-seat-category.action";
import {
  createSeatCategorySchema,
  type CreateSeatCategoryInput,
} from "@/features/seat-categories/schemas/seat-category.schema";

export function useCreateSeatCategoryForm() {
  const form = useForm<CreateSeatCategoryInput>({
    resolver: zodResolver(createSeatCategorySchema),
    defaultValues: {
      name: "",
      description: "",
      safety_standard: "",
      is_active: true,
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] =
    useState<CreateSeatCategoryActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await createSeatCategoryAction(values));
    });
  });

  return { form, onSubmit, isPending, result };
}
