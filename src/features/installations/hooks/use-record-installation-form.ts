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
  INSTALLATION_CHECKLIST,
  getChecklistHint,
  getMissingChecklistItems,
  toggleChecklistKey,
  type InstallationChecklistKey,
} from "@/features/installations/lib/installation-checklist";
import {
  buildRecordInstallationSchema,
  type RecordInstallationInput,
} from "@/features/installations/schemas/record-installation.schema";

const DRAFT_FIELDS = ["installed_at", "notes", "vehicle_location"] as const;

type InstallationStep = "checklist" | "details";

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
      checklist: [],
      vehicle_location: "",
    },
  });
  const discardDraft = useStepDraft(form, "installation", jobId, DRAFT_FIELDS);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);
  const [step, setStep] = useState<InstallationStep>("checklist");
  const checked = form.watch("checklist");
  const remaining = getMissingChecklistItems(checked).length;

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await runJobAction(() => recordInstallationAction(values)));
    });
  });

  function toggleItem(key: InstallationChecklistKey) {
    form.clearErrors("checklist");
    form.setValue("checklist", toggleChecklistKey(form.getValues("checklist"), key));
  }

  // The schema says what is missing; the step changes only when nothing is.
  async function continueToDetails() {
    if (await form.trigger("checklist")) {
      setStep("details");
    }
  }

  // Someone else recorded this job first. The user's entry stays on screen
  // until they choose to look at the record that was kept: re-running the
  // Server Component fetch swaps the form for that record.
  function viewRecordedInstallation() {
    router.refresh();
  }

  return {
    form,
    onSubmit,
    isPending,
    result,
    viewRecordedInstallation,
    discardDraft,
    step,
    backToChecklist: () => setStep("checklist"),
    continueToDetails,
    checklist: {
      items: INSTALLATION_CHECKLIST,
      checked,
      total: INSTALLATION_CHECKLIST.length,
      completed: INSTALLATION_CHECKLIST.length - remaining,
      hint: getChecklistHint(remaining),
      toggleItem,
    },
  };
}
