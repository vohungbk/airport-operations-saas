"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  changeSeatStatusAction,
  type ChangeSeatStatusActionResult,
} from "@/features/seats/actions/change-seat-status.action";
import {
  changeSeatStatusSchema,
  type ChangeSeatStatusInput,
} from "@/features/seats/schemas/seat.schema";

interface UseChangeSeatStatusFormArgs {
  seatId: string;
  defaultStatus: ChangeSeatStatusInput["to_status"];
  onSuccess: () => void;
}

export function useChangeSeatStatusForm({
  seatId,
  defaultStatus,
  onSuccess,
}: UseChangeSeatStatusFormArgs) {
  const router = useRouter();
  const form = useForm<ChangeSeatStatusInput>({
    resolver: zodResolver(changeSeatStatusSchema),
    defaultValues: { seat_id: seatId, to_status: defaultStatus, reason: "" },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ChangeSeatStatusActionResult | null>(
    null,
  );

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const next = await changeSeatStatusAction(values);
      setResult(next);

      if (next.success) {
        onSuccess();
        // Re-runs the Server Component fetch so status and history cannot go stale.
        router.refresh();
      }
    });
  });

  function reset() {
    setResult(null);
    form.reset({ seat_id: seatId, to_status: defaultStatus, reason: "" });
  }

  return { form, onSubmit, isPending, result, reset };
}
