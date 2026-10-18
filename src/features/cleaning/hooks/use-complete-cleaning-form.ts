"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { completeCleaningAction } from "@/features/cleaning/actions/complete-cleaning.action";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import { runJobAction } from "@/features/jobs/lib/run-job-action";
import {
  completeCleaningSchema,
  type CompleteCleaningInput,
} from "@/features/cleaning/schemas/cleaning.schema";

export function useCompleteCleaningForm(jobId: string) {
  const router = useRouter();
  const form = useForm<CompleteCleaningInput>({
    resolver: zodResolver(completeCleaningSchema),
    // No default result: the technician has to choose one.
    defaultValues: { job_id: jobId, notes: "" },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await runJobAction(() => completeCleaningAction(values)));
    });
  });

  // Someone else completed this cleaning first. The user's entry stays on
  // screen until they choose to look at the cleaning that was kept.
  function viewCleaning() {
    router.refresh();
  }

  return { form, onSubmit, isPending, result, viewCleaning };
}
