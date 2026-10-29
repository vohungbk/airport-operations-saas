"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { recordInstallationAction } from "@/features/installations/actions/record-installation.action";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import { useStepDraft } from "@/features/jobs/hooks/use-step-draft";
import { runJobAction } from "@/features/jobs/lib/run-job-action";
import {
  buildRecordInstallationSchema,
  type RecordInstallationInput,
} from "@/features/installations/schemas/record-installation.schema";

const DRAFT_FIELDS = ["installed_at", "notes"] as const;

interface UseRecordInstallationFormArgs {
  jobId: string;
  seatId: string;
  timeZone: string;
  defaultInstalledAt: string;
}

export function useRecordInstallationForm({
  jobId,
  seatId,
  timeZone,
  defaultInstalledAt,
}: UseRecordInstallationFormArgs) {
  const router = useRouter();
  const schema = useMemo(
    () => buildRecordInstallationSchema(timeZone),
    [timeZone],
  );
  const form = useForm<RecordInstallationInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      job_id: jobId,
      seat_id: seatId,
      installed_at: defaultInstalledAt,
      notes: "",
    },
  });
  const discardDraft = useStepDraft(form, "installation", jobId, DRAFT_FIELDS);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await runJobAction(() => recordInstallationAction(values)));
    });
  });

  // Someone else recorded this job first. The user's entry stays on screen
  // until they choose to look at the record that was kept: re-running the
  // Server Component fetch swaps the form for that record.
  function viewRecordedInstallation() {
    router.refresh();
  }

  return { form, onSubmit, isPending, result, viewRecordedInstallation, discardDraft };
}
