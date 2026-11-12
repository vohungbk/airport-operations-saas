import type { BookingStatus } from "@/features/bookings/types";
import type { SeatStatus } from "@/features/seats/types";

/** The seven steps of the return chain, in order (FO-F08 §3). */
export const RETURN_CHAIN_STEPS = [
  "returned",
  "initial_inspection",
  "cleaning",
  "drying",
  "reassembly",
  "final_inspection",
  "available",
] as const;

export type ReturnChainStep = (typeof RETURN_CHAIN_STEPS)[number];

/** A step of the chain, or Quarantine for a seat that failed a step. */
export const RETURN_QUEUE_STEPS = [...RETURN_CHAIN_STEPS, "quarantine"] as const;

export type ReturnQueueStep = (typeof RETURN_QUEUE_STEPS)[number];

export const RETURN_QUEUE_STEP_LABEL: Record<ReturnQueueStep, string> = {
  returned: "Returned",
  initial_inspection: "Initial inspection",
  cleaning: "Cleaning",
  drying: "Drying",
  reassembly: "Reassembly",
  final_inspection: "Final inspection",
  available: "Available",
  quarantine: "Quarantine",
};

/** The booking statuses of a seat that is in the chain. */
export const RETURN_CHAIN_BOOKING_STATUSES = [
  "returned",
  "cleaning",
  "inspection",
] as const satisfies readonly BookingStatus[];

export type ReturnChainBookingStatus =
  (typeof RETURN_CHAIN_BOOKING_STATUSES)[number];

/**
 * The booking path has three of the chain steps; the steps in between are
 * known from the recorded steps. The inspection after cleaning is the final
 * inspection.
 */
const STEP_OF_BOOKING_STATUS: Record<ReturnChainBookingStatus, ReturnChainStep> = {
  returned: "returned",
  cleaning: "cleaning",
  inspection: "final_inspection",
};

/** The chain step the booking status points to. Pure. */
export function chainStepOf(status: ReturnChainBookingStatus): ReturnChainStep {
  return STEP_OF_BOOKING_STATUS[status];
}

/** The steps a user records: every step but Available, the end of the chain. */
export const RECORDED_CHAIN_STEPS = [
  "returned",
  "initial_inspection",
  "cleaning",
  "drying",
  "reassembly",
  "final_inspection",
] as const satisfies readonly ReturnChainStep[];

export type RecordedChainStep = (typeof RECORDED_CHAIN_STEPS)[number];

export type ChainStepResult = "pass" | "fail";

/** A recorded step, as the query returns it. */
export interface RecordedChainStepRow {
  step: RecordedChainStep;
  result: ChainStepResult;
  completed_at: string;
}

/** The latest recorded step, by chain order; null when none is recorded. Pure. */
export function lastRecordedStep(
  recorded: readonly RecordedChainStepRow[],
): RecordedChainStepRow | null {
  let last: RecordedChainStepRow | null = null;

  for (const row of recorded) {
    if (!last || chainStepNumber(row.step) > chainStepNumber(last.step)) {
      last = row;
    }
  }

  return last;
}

/**
 * The step the booking is at: the step after the last recorded one, never
 * before the step the booking status points to. A failed step stays the
 * current step: the chain stops there. Same rule as
 * complete_return_chain_step(). Pure.
 */
export function currentChainStep(
  status: ReturnChainBookingStatus,
  recorded: readonly RecordedChainStepRow[],
): ReturnChainStep {
  const fromStatus = chainStepOf(status);
  const last = lastRecordedStep(recorded);

  if (!last) return fromStatus;
  if (last.result === "fail") return last.step;

  const index = Math.max(
    RETURN_CHAIN_STEPS.indexOf(fromStatus),
    RETURN_CHAIN_STEPS.indexOf(last.step) + 1,
  );

  return RETURN_CHAIN_STEPS[Math.min(index, RETURN_CHAIN_STEPS.length - 1)];
}

/** The queue step: Quarantine wins over the chain step of a failed seat. Pure. */
export function queueStepOf(
  step: ReturnChainStep,
  seatStatus: SeatStatus | null,
): ReturnQueueStep {
  return seatStatus === "quarantine" ? "quarantine" : step;
}

/** `Cleaning`, or `Final inspection failed` for a quarantined seat. Pure. */
export function currentStepLabel(
  step: ReturnChainStep,
  seatStatus: SeatStatus | null,
): string {
  const label = RETURN_QUEUE_STEP_LABEL[step];

  return seatStatus === "quarantine" ? `${label} failed` : label;
}

interface ChainChecklistItem {
  id: string;
  label: string;
}

/**
 * The checklist of each step. Placeholder items until the spec answers Q1;
 * Cleaning follows the design. Keep in step with return_chain_checklist().
 */
export const RETURN_CHAIN_CHECKLIST: Record<RecordedChainStep, readonly ChainChecklistItem[]> = {
  returned: [
    { id: "seat_received", label: "Seat received" },
    { id: "serial_matches", label: "Serial number matches" },
    { id: "parts_returned", label: "All parts returned" },
  ],
  initial_inspection: [
    { id: "shell_checked", label: "Shell checked" },
    { id: "harness_checked", label: "Harness checked" },
    { id: "buckle_checked", label: "Buckle checked" },
  ],
  cleaning: [
    { id: "shell_cleaned", label: "Shell cleaned" },
    { id: "harness_cleaned", label: "Harness cleaned" },
    { id: "straps_cleaned", label: "Straps cleaned" },
  ],
  drying: [
    { id: "cover_dry", label: "Cover dry" },
    { id: "foam_dry", label: "Foam dry" },
    { id: "straps_dry", label: "Straps dry" },
  ],
  reassembly: [
    { id: "cover_fitted", label: "Cover fitted" },
    { id: "harness_fitted", label: "Harness fitted" },
    { id: "buckle_fitted", label: "Buckle fitted" },
  ],
  final_inspection: [
    { id: "shell_intact", label: "Shell intact" },
    { id: "harness_works", label: "Harness works" },
    { id: "buckle_locks", label: "Buckle locks" },
  ],
};

export function isRecordedChainStep(step: ReturnChainStep): step is RecordedChainStep {
  return (RECORDED_CHAIN_STEPS as readonly string[]).includes(step);
}

export type ReturnChainStepState = "completed" | "current" | "failed" | "locked";

export const RETURN_CHAIN_STEP_STATE_LABEL: Record<ReturnChainStepState, string> = {
  completed: "Completed",
  current: "Current step",
  failed: "Failed",
  locked: "Locked",
};

export interface ReturnChainProgressStep {
  step: ReturnChainStep;
  label: string;
  state: ReturnChainStepState;
}

/**
 * The seven steps with the state of each: done before the current step,
 * locked after it. A quarantined seat failed its current step. Pure.
 */
export function buildChainProgress(
  current: ReturnChainStep,
  failed: boolean,
): ReturnChainProgressStep[] {
  const currentIndex = RETURN_CHAIN_STEPS.indexOf(current);

  return RETURN_CHAIN_STEPS.map((step, index) => ({
    step,
    label: RETURN_QUEUE_STEP_LABEL[step],
    state:
      index < currentIndex
        ? "completed"
        : index > currentIndex
          ? "locked"
          : failed
            ? "failed"
            : "current",
  }));
}

/** 1-based position of a step in the chain. Pure. */
export function chainStepNumber(step: ReturnChainStep): number {
  return RETURN_CHAIN_STEPS.indexOf(step) + 1;
}
