"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { recordInstallationAction } from "@/features/installations/actions/record-installation.action";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import { isAlreadyRecordedError } from "@/features/installations/lib/installation-errors";
import { runJobAction } from "@/features/jobs/lib/run-job-action";
import {
  buildRecordInstallationSchema,
  type RecordInstallationInput,
} from "@/features/installations/schemas/record-installation.schema";

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
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const next = await runJobAction(() => recordInstallationAction(values));
      setResult(next);

      // Someone else recorded this job first: re-run the Server Component
      // fetch so the page shows the existing record instead of the form.
      if (isAlreadyRecordedError(next.error)) {
        router.refresh();
      }
    });
  });

  return { form, onSubmit, isPending, result };
}
