"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { changeJobStatusAction } from "@/features/jobs/actions/change-job-status.action";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import type { JobStatus, JobTargetStatus } from "@/features/jobs/lib/job-status";
import {
  changeJobStatusSchema,
  type ChangeJobStatusInput,
} from "@/features/jobs/schemas/change-job-status.schema";

interface UseChangeJobStatusFormArgs {
  jobId: string;
  currentStatus: JobStatus;
  defaultStatus: JobTargetStatus;
  onSuccess: () => void;
}

export function useChangeJobStatusForm({
  jobId,
  currentStatus,
  defaultStatus,
  onSuccess,
}: UseChangeJobStatusFormArgs) {
  const router = useRouter();
  const form = useForm<ChangeJobStatusInput>({
    resolver: zodResolver(changeJobStatusSchema),
    defaultValues: {
      job_id: jobId,
      from_status: currentStatus,
      to_status: defaultStatus,
      reason: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const next = await changeJobStatusAction(values);
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
    form.reset();
  }

  return { form, onSubmit, isPending, result, reset };
}
