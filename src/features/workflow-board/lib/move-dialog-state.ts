import type { BookingActionError } from "@/features/bookings/lib/booking-errors";
import type { MoveReadiness } from "@/features/bookings/lib/booking-move";
import type { SeatStatus } from "@/features/seats/types";

/** Errors after which the same move cannot work until something else changes. */
const BLOCKING_CODES = new Set<BookingActionError["code"]>([
  "INVALID_TRANSITION",
  "NO_SEAT",
  "SEAT_NOT_READY",
  "FORBIDDEN",
  "NOT_FOUND",
]);

export interface MoveDialogState {
  message: string | null;
  seatStatus: SeatStatus | undefined;
  /** Another user moved the booking first: Refresh replaces Move. */
  conflict: boolean;
  /** The role may not move the booking (any more): no Move and no note, only Cancel. */
  forbidden: boolean;
  /** Move is disabled. A failed save (network) is not blocking: the note stays and Move retries. */
  blocked: boolean;
}

/**
 * What the Move dialog shows for the readiness of the seat and the last error of the action
 * (CO-F08-S10): a network failure keeps the dialog as it is so the person can retry; a lost
 * permission leaves only Cancel.
 */
export function getMoveDialogState(readiness: MoveReadiness, error: BookingActionError | undefined): MoveDialogState {
  const readinessSeatStatus = !readiness.ok && readiness.code === "SEAT_NOT_READY" ? readiness.seat_status : undefined;

  return {
    message: error?.message ?? (readiness.ok ? null : readiness.message),
    seatStatus: error?.seat_status ?? readinessSeatStatus,
    conflict: error?.code === "STEP_CHANGED",
    forbidden: error?.code === "FORBIDDEN",
    blocked: !readiness.ok || (error !== undefined && BLOCKING_CODES.has(error.code)),
  };
}
