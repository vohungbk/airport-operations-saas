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
 * The booking path has three of the chain steps today; the other steps are
 * recorded once the chain steps are stored (FO-F08-S02). The inspection after
 * cleaning is the final inspection.
 */
const STEP_OF_BOOKING_STATUS: Record<ReturnChainBookingStatus, ReturnChainStep> = {
  returned: "returned",
  cleaning: "cleaning",
  inspection: "final_inspection",
};

/** The chain step the booking is at. Pure. */
export function chainStepOf(status: ReturnChainBookingStatus): ReturnChainStep {
  return STEP_OF_BOOKING_STATUS[status];
}

/** The queue step: Quarantine wins over the chain step of a failed seat. Pure. */
export function queueStepOf(
  status: ReturnChainBookingStatus,
  seatStatus: SeatStatus | null,
): ReturnQueueStep {
  return seatStatus === "quarantine" ? "quarantine" : chainStepOf(status);
}

/** `Cleaning`, or `Final inspection failed` for a quarantined seat. Pure. */
export function currentStepLabel(
  status: ReturnChainBookingStatus,
  seatStatus: SeatStatus | null,
): string {
  const label = RETURN_QUEUE_STEP_LABEL[chainStepOf(status)];

  return seatStatus === "quarantine" ? `${label} failed` : label;
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
