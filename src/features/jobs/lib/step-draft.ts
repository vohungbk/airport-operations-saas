import type { StepName } from "@/features/jobs/lib/step-done";

/**
 * The draft of a step (UI-F07-S04, spec E4). A phone that is put in the background may drop the page; the
 * browser keeps `sessionStorage` for the tab, so what the technician typed comes back with the same step. Only
 * the named text fields of the step are kept, and the draft is dropped when the step is done. Every access is
 * guarded: storage can be blocked, and the form must work without it.
 */

export type StepDraft = Record<string, string>;

export function stepDraftKey(step: StepName, jobId: string): string {
  return `step-draft:${step}:${jobId}`;
}

/** The values of `fields` that are strings; anything else in the stored text is ignored. */
export function pickDraft(
  values: Record<string, unknown>,
  fields: readonly string[],
): StepDraft {
  const draft: StepDraft = {};

  for (const field of fields) {
    const value = values[field];

    if (typeof value === "string") {
      draft[field] = value;
    }
  }

  return draft;
}

export function readStepDraft(key: string, fields: readonly string[]): StepDraft {
  try {
    const text = window.sessionStorage.getItem(key);
    const parsed: unknown = text ? JSON.parse(text) : null;

    return parsed && typeof parsed === "object"
      ? pickDraft(parsed as Record<string, unknown>, fields)
      : {};
  } catch {
    return {};
  }
}

export function writeStepDraft(key: string, draft: StepDraft): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage is blocked or full: the form keeps working, the draft is lost.
  }
}

export function clearStepDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}
