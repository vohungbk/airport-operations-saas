"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { toast } from "@/components/ui/toast";
import { runClientAction } from "@/lib/actions/run-client-action";
import { zodResolver } from "@/lib/validation/zod-resolver";
import { enterManualArrivalAction } from "@/features/flights/actions/enter-manual-arrival.action";
import { NETWORK_ERROR, type ManualArrivalResult } from "@/features/flights/lib/manual-arrival-errors";
import {
  MANUAL_ARRIVAL_DEFAULTS,
  createManualArrivalSchema,
  type ManualArrivalInput,
} from "@/features/flights/schemas/manual-arrival.schema";

interface UseManualArrivalFormArgs {
  bookingId: string;
  /** True for a booking with no flight yet: the scheduled arrival is asked too. */
  requireScheduled: boolean;
  onSuccess: () => void;
}

/**
 * VI-F02-S07: the state of the manual arrival form. A call that does not get through becomes a network
 * error and the form keeps what was typed (E8); a field the server refused shows the server's message
 * under it. A saved entry closes the dialog and re-reads the page so the Manual mark and the history show.
 */
export function useManualArrivalForm({ bookingId, requireScheduled, onSuccess }: UseManualArrivalFormArgs) {
  const router = useRouter();
  const schema = useMemo(() => createManualArrivalSchema({ requireScheduled }), [requireScheduled]);
  const form = useForm<ManualArrivalInput>({
    resolver: zodResolver(schema),
    defaultValues: MANUAL_ARRIVAL_DEFAULTS,
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ManualArrivalResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const next = await runClientAction(
        () => enterManualArrivalAction({ ...values, booking_id: bookingId }),
        NETWORK_ERROR,
      );

      for (const detail of next.error?.details ?? []) {
        form.setError(detail.field as keyof ManualArrivalInput, { type: "server", message: detail.issue });
      }

      setResult(next);

      if (next.success) {
        toast("Arrival saved as Manual", "success");
        onSuccess();
        router.refresh();
      }
    });
  });

  function reset() {
    setResult(null);
    form.reset(MANUAL_ARRIVAL_DEFAULTS);
  }

  return { form, onSubmit, isPending, result, reset };
}
