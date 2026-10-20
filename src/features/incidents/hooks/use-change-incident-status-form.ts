"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { changeIncidentStatusAction } from "@/features/incidents/actions/change-incident-status.action";
import type { JobActionResult } from "@/features/jobs/lib/job-errors";
import { runJobAction } from "@/features/jobs/lib/run-job-action";
import type { IncidentStatus } from "@/features/incidents/lib/incident-status";
import {
  changeIncidentStatusSchema,
  type ChangeIncidentStatusInput,
} from "@/features/incidents/schemas/change-incident-status.schema";

interface UseChangeIncidentStatusFormArgs {
  incidentId: string;
  currentStatus: IncidentStatus;
  defaultStatus: IncidentStatus;
  onSuccess: () => void;
}

export function useChangeIncidentStatusForm({
  incidentId,
  currentStatus,
  defaultStatus,
  onSuccess,
}: UseChangeIncidentStatusFormArgs) {
  const router = useRouter();
  const form = useForm<ChangeIncidentStatusInput>({
    resolver: zodResolver(changeIncidentStatusSchema),
    defaultValues: {
      incident_id: incidentId,
      from_status: currentStatus,
      to_status: defaultStatus,
      note: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  // The status moved (another user's change, or ours): the next Confirm must
  // be checked against the status now shown, with a target that is allowed.
  const { reset: resetForm } = form;
  useEffect(() => {
    resetForm({
      incident_id: incidentId,
      from_status: currentStatus,
      to_status: defaultStatus,
      note: "",
    });
  }, [resetForm, incidentId, currentStatus, defaultStatus]);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const next = await runJobAction(() => changeIncidentStatusAction(values));
      setResult(next);

      // Re-runs the Server Component fetch so status and history cannot go
      // stale: after our change, or when someone else changed the incident.
      if (next.success || next.error?.code === "STALE_DATA") {
        router.refresh();
      }

      if (next.success) {
        onSuccess();
      }
    });
  });

  function reset() {
    setResult(null);
    form.reset();
  }

  return { form, onSubmit, isPending, result, reset };
}
