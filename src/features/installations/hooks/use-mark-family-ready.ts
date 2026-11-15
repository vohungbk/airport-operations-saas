"use client";

import { useState, useTransition } from "react";

import { markFamilyReadyAction } from "@/features/installations/actions/mark-family-ready.action";
import {
  isEveryCheckConfirmed,
  type FamilyReadyCheckKey,
} from "@/features/installations/lib/family-ready";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import { runJobAction } from "@/features/jobs/lib/run-job-action";

export function useMarkFamilyReady(jobId: string) {
  const [checked, setChecked] = useState<FamilyReadyCheckKey[]>([]);
  const [result, setResult] = useState<JobActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(key: FamilyReadyCheckKey) {
    setChecked((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  function submit() {
    setResult(null);
    startTransition(async () => {
      setResult(await runJobAction(() => markFamilyReadyAction({ job_id: jobId })));
    });
  }

  return {
    checked,
    toggle,
    submit,
    isPending,
    result,
    canSubmit: isEveryCheckConfirmed(checked) && !isPending,
  };
}
