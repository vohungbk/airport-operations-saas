import type { CleaningRecord } from "@/features/cleaning/lib/get-cleaning-context";

/**
 * What the Admin and Operations Manager panel shows. The dialog (Success or
 * Failed) belongs to `in_progress`; a failed cleaning ends in `failed`, which
 * also shows the Quarantine view when the seat is in Quarantine.
 */
export type CleaningPanelState =
  | "not_started"
  | "in_progress"
  | "completed_passed"
  | "failed"
  | "blocked";

interface PanelStateInput {
  cleaning: CleaningRecord | null;
  /** A booking holds or uses the seat in the cleaning period. */
  hasBookingConflict: boolean;
}

/** Pure. The recorded cleaning wins; a booking conflict only blocks the start. */
export function getCleaningPanelState({
  cleaning,
  hasBookingConflict,
}: PanelStateInput): CleaningPanelState {
  if (cleaning?.completed_at) {
    return cleaning.passed === false ? "failed" : "completed_passed";
  }

  if (cleaning) {
    return "in_progress";
  }

  return hasBookingConflict ? "blocked" : "not_started";
}

/** Whole minutes between two instants, never negative. */
export function getElapsedMinutes(startedAt: string, now: Date): number {
  const elapsed = now.getTime() - new Date(startedAt).getTime();

  return Math.max(0, Math.floor(elapsed / 60_000));
}
