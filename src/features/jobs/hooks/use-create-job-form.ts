"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { createJobAction } from "@/features/jobs/actions/create-job.action";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import {
  createJobSchema,
  type CreateJobInput,
} from "@/features/jobs/schemas/create-job.schema";

export function useCreateJobForm() {
  const form = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      job_type: "" as CreateJobInput["job_type"],
      technician_id: "",
      booking_id: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await createJobAction(values));
    });
  });

  return { form, onSubmit, isPending, result };
}
