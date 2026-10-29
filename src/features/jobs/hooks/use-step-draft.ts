"use client";

import { useCallback, useEffect } from "react";
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";

import {
  clearStepDraft,
  pickDraft,
  readStepDraft,
  stepDraftKey,
  writeStepDraft,
} from "@/features/jobs/lib/step-draft";
import type { StepName } from "@/features/jobs/lib/step-done";

/**
 * Keeps what the technician entered in a step form in `sessionStorage`, and puts it back when the page
 * loads again (UI-F07-S04, AC04). Returns the function that drops the draft. `fields` must be a constant:
 * it is a dependency of the effect.
 */
export function useStepDraft<T extends FieldValues>(
  form: UseFormReturn<T>,
  step: StepName,
  jobId: string,
  fields: readonly Path<T>[],
) {
  const key = stepDraftKey(step, jobId);

  useEffect(() => {
    for (const [name, value] of Object.entries(readStepDraft(key, fields))) {
      form.setValue(name as Path<T>, value as PathValue<T, Path<T>>);
    }

    const subscription = form.watch((values) => {
      writeStepDraft(key, pickDraft(values as Record<string, unknown>, fields));
    });

    return () => subscription.unsubscribe();
  }, [form, key, fields]);

  /** For Cancel: leaving the step on purpose throws the draft away. */
  return useCallback(() => clearStepDraft(key), [key]);
}
