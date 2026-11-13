"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { createJobAction } from "@/features/jobs/actions/create-job.action";
import { updateJobAction } from "@/features/jobs/actions/update-job.action";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import { runJobAction } from "@/features/jobs/lib/run-job-action";
import {
  createJobSchema,
  type CreateJobInput,
} from "@/features/jobs/schemas/create-job.schema";

const EMPTY_VALUES: CreateJobInput = {
  job_type: "" as CreateJobInput["job_type"],
  technician_id: "",
  booking_id: "",
};

interface UseJobFormProps {
  /** Set for an edit: the job to update. Without it the form creates a job. */
  jobId?: string;
  /** The current values of the job being edited. */
  defaultValues?: CreateJobInput;
}

/**
 * One form for Create and Edit. An edit keeps the booking of the job in the
 * form so the same schema applies, but only the job type and the technician
 * are sent: the booking cannot be changed.
 */
export function useJobForm({ jobId, defaultValues }: UseJobFormProps = {}) {
  const form = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: defaultValues ?? EMPTY_VALUES,
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(
        await runJobAction(() =>
          jobId
            ? updateJobAction({
                id: jobId,
                job_type: values.job_type,
                technician_id: values.technician_id,
              })
            : createJobAction(values),
        ),
      );
    });
  });

  return { form, onSubmit, isPending, result };
}
