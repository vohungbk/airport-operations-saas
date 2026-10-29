"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { recordInspectionAction } from "@/features/inspections/actions/record-inspection.action";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import { useStepDraft } from "@/features/jobs/hooks/use-step-draft";
import { runJobAction } from "@/features/jobs/lib/run-job-action";
import {
  recordInspectionSchema,
  type RecordInspectionInput,
} from "@/features/inspections/schemas/record-inspection.schema";

const DRAFT_FIELDS = ["result", "notes"] as const;

interface UseRecordInspectionFormArgs {
  jobId: string;
  seatId: string;
}

export function useRecordInspectionForm({
  jobId,
  seatId,
}: UseRecordInspectionFormArgs) {
  const router = useRouter();
  const form = useForm<RecordInspectionInput>({
    resolver: zodResolver(recordInspectionSchema),
    // No default result: the technician has to choose one.
    defaultValues: { job_id: jobId, seat_id: seatId, notes: "" },
  });
  const discardDraft = useStepDraft(form, "inspection", jobId, DRAFT_FIELDS);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await runJobAction(() => recordInspectionAction(values)));
    });
  });

  // Someone else recorded this job first. The user's entry stays on screen
  // until they choose to look at the record that was kept: re-running the
  // Server Component fetch swaps the form for that record.
  function viewRecordedInspection() {
    router.refresh();
  }

  return { form, onSubmit, isPending, result, viewRecordedInspection, discardDraft };
}
