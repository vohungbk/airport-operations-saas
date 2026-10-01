"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  updateSeatCategoryAction,
  type UpdateSeatCategoryActionResult,
} from "@/features/seat-categories/actions/update-seat-category.action";
import {
  updateSeatCategorySchema,
  type UpdateSeatCategoryInput,
} from "@/features/seat-categories/schemas/seat-category.schema";

interface UseUpdateSeatCategoryFormArgs {
  seatCategoryId: string;
  defaultValues: UpdateSeatCategoryInput;
}

export function useUpdateSeatCategoryForm({
  seatCategoryId,
  defaultValues,
}: UseUpdateSeatCategoryFormArgs) {
  const form = useForm<UpdateSeatCategoryInput>({
    resolver: zodResolver(updateSeatCategorySchema),
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] =
    useState<UpdateSeatCategoryActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await updateSeatCategoryAction(seatCategoryId, values));
    });
  });

  return { form, onSubmit, isPending, result };
}
