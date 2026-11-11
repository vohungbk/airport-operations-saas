"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { toast } from "@/components/ui/toast";
import { zodResolver } from "@/lib/validation/zod-resolver";
import { completeCleaningAction } from "@/features/cleaning/actions/complete-cleaning.action";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import { runJobAction } from "@/features/jobs/lib/run-job-action";
import {
  completeCleaningSchema,
  type CompleteCleaningInput,
} from "@/features/cleaning/schemas/cleaning.schema";

/**
 * The Complete cleaning dialog of the Admin and Operations Manager panel. A
 * failed save keeps the dialog open with what was typed, so the user can retry
 * (AC08). A saved cleaning closes it, shows a toast and re-reads the panel.
 */
export function useCompleteCleaningDialog(jobId: string, seatSerial: string) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<CompleteCleaningInput>({
    resolver: zodResolver(completeCleaningSchema),
    // No default result: the user has to choose one.
    defaultValues: { job_id: jobId, notes: "" },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const next = await runJobAction(() => completeCleaningAction(values));
      setResult(next);

      if (next.success) {
        setOpen(false);
        form.reset({ job_id: jobId, notes: "" });
        toast(
          values.result === "passed"
            ? `Cleaning completed. ${seatSerial} is Available.`
            : "Cleaning completed. The seat stays out of service.",
          "success",
        );
        router.refresh();
      }
    });
  });

  function onOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setResult(null);
  }

  return { open, onOpenChange, form, onSubmit, isPending, result };
}
