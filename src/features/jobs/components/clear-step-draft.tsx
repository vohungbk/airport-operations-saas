"use client";

import { useEffect } from "react";

import { clearStepDraft, stepDraftKey } from "@/features/jobs/lib/step-draft";
import type { StepName } from "@/features/jobs/lib/step-done";

interface ClearStepDraftProps {
  step: StepName;
  jobId: string;
}

/** On the success screen of a step the saved draft has done its job: drop it. Draws nothing. */
export function ClearStepDraft({ step, jobId }: ClearStepDraftProps) {
  useEffect(() => {
    clearStepDraft(stepDraftKey(step, jobId));
  }, [step, jobId]);

  return null;
}
