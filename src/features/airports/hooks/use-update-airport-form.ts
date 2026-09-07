"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  updateAirportAction,
  type UpdateAirportActionResult,
} from "@/features/airports/actions/update-airport.action";
import {
  updateAirportSchema,
  type UpdateAirportInput,
} from "@/features/airports/schemas/airport.schema";

interface UseUpdateAirportFormArgs {
  airportId: string;
  defaultValues: UpdateAirportInput;
}

export function useUpdateAirportForm({
  airportId,
  defaultValues,
}: UseUpdateAirportFormArgs) {
  const form = useForm<UpdateAirportInput>({
    resolver: zodResolver(updateAirportSchema),
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<UpdateAirportActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await updateAirportAction(airportId, values));
    });
  });

  return { form, onSubmit, isPending, result };
}
