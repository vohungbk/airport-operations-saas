"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { recordCleaningAction } from "@/features/cleaning/actions/record-cleaning.action";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import { runJobAction } from "@/features/jobs/lib/run-job-action";
import {
  buildRecordCleaningSchema,
  type RecordCleaningInput,
} from "@/features/cleaning/schemas/record-cleaning.schema";

interface UseRecordCleaningFormArgs {
  jobId: string;
  seatId: string;
  timeZone: string;
  defaultCleanedAt: string;
}

export function useRecordCleaningForm({
  jobId,
  seatId,
  timeZone,
  defaultCleanedAt,
}: UseRecordCleaningFormArgs) {
  const router = useRouter();
  const schema = useMemo(
    () => buildRecordCleaningSchema(timeZone),
    [timeZone],
  );
  const form = useForm<RecordCleaningInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      job_id: jobId,
      seat_id: seatId,
      cleaned_at: defaultCleanedAt,
      notes: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await runJobAction(() => recordCleaningAction(values)));
    });
  });

  // Someone else recorded this job first. The user's entry stays on screen
  // until they choose to look at the record that was kept: re-running the
  // Server Component fetch swaps the form for that record.
  function viewRecordedCleaning() {
    router.refresh();
  }

  return { form, onSubmit, isPending, result, viewRecordedCleaning };
}
