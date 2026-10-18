"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { startCleaningAction } from "@/features/cleaning/actions/start-cleaning.action";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import { runJobAction } from "@/features/jobs/lib/run-job-action";

export function useStartCleaning(jobId: string) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  function start() {
    setResult(null);
    startTransition(async () => {
      const next = await runJobAction(() => startCleaningAction({ job_id: jobId }));
      setResult(next);

      // Re-runs the Server Component fetch so the screen moves to the
      // "in progress" step.
      if (next.success) {
        router.refresh();
      }
    });
  }

  // Someone else started this job first: show the cleaning that was kept.
  function viewCleaning() {
    router.refresh();
  }

  return { start, isPending, result, viewCleaning };
}
