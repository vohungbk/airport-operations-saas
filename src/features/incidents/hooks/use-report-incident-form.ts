"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { reportIncidentAction } from "@/features/incidents/actions/report-incident.action";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import { runJobAction } from "@/features/jobs/lib/run-job-action";
import {
  reportIncidentSchema,
  type ReportIncidentInput,
} from "@/features/incidents/schemas/report-incident.schema";

interface UseReportIncidentFormArgs {
  initialJobId: string;
}

export function useReportIncidentForm({
  initialJobId,
}: UseReportIncidentFormArgs) {
  const form = useForm<ReportIncidentInput>({
    resolver: zodResolver(reportIncidentSchema),
    defaultValues: {
      job_id: initialJobId,
      // No default severity: the reporter has to choose one.
      severity: "" as ReportIncidentInput["severity"],
      description: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await runJobAction(() => reportIncidentAction(values)));
    });
  });

  return { form, onSubmit, isPending, result };
}
