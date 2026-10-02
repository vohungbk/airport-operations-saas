"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  updateSeatAction,
  type UpdateSeatActionResult,
} from "@/features/seats/actions/update-seat.action";
import {
  buildUpdateSeatSchema,
  type UpdateSeatInput,
} from "@/features/seats/schemas/seat.schema";

interface UseUpdateSeatFormArgs {
  seatId: string;
  rentalCycles: number;
  defaultValues: UpdateSeatInput;
}

export function useUpdateSeatForm({
  seatId,
  rentalCycles,
  defaultValues,
}: UseUpdateSeatFormArgs) {
  const form = useForm<UpdateSeatInput>({
    resolver: zodResolver(buildUpdateSeatSchema(rentalCycles)),
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<UpdateSeatActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await updateSeatAction(seatId, values));
    });
  });

  return { form, onSubmit, isPending, result };
}
