import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { BookingStatus } from "@/features/bookings/types";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";
import type { SeatStatus } from "@/features/seats/types";
import type { Role } from "@/lib/auth/roles";
import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";

/**
 * Moving a booking to its next step (CO-F08-S03). The database function `move_booking_to_next_step()`
 * holds these rules and has the last word; this module is the same rules for the screen (which
 * button to show, what the dialog says) and for the clear messages. Pure, no I/O.
 */

/** The step after `status` on the path, or `null` at the last step or off the path. */
export function getNextStep(status: BookingStatus): BookingStatus | null {
  const index = (BOOKING_BOARD_STEPS as readonly BookingStatus[]).indexOf(status);
  return index === -1 ? null : (BOOKING_BOARD_STEPS[index + 1] ?? null);
}

/**
 * The roles that may move a booking to each step. Admin and operations manager move to every step.
 * The field steps may also be moved by the technician assigned to the booking; the database checks
 * the assignment, which this list cannot.
 */
export const STEP_MOVER_ROLES: Partial<Record<BookingStatus, readonly Role[]>> = {
  confirmed: ["admin", "operations_manager"],
  assigned: ["admin", "operations_manager"],
  in_progress: ["admin", "operations_manager", "technician"],
  completed: ["admin", "operations_manager", "technician"],
};

export function mayRoleMoveTo(role: Role, step: BookingStatus): boolean {
  return STEP_MOVER_ROLES[step]?.includes(role) ?? false;
}

/** The status the seat has to be in for a step, and the status it follows to. */
export const SEAT_FOLLOWS: Partial<Record<BookingStatus, { from: SeatStatus; to: SeatStatus }>> = {
  assigned: { from: "available", to: "reserved" },
  in_progress: { from: "reserved", to: "in_use" },
  completed: { from: "in_use", to: "available" },
};

export const NO_SEAT_MESSAGE = "Assign a seat to this booking first.";

export function seatNotReadyMessage(step: BookingStatus): string {
  const follows = SEAT_FOLLOWS[step];
  return `The seat must be ${SEAT_STATUS_LABEL[follows?.from ?? "available"]} before ${BOOKING_STATUS_LABEL[step]}`;
}

export type MoveReadiness =
  | { ok: true }
  | { ok: false; code: "NO_SEAT"; message: string }
  | { ok: false; code: "SEAT_NOT_READY"; message: string; seat_status: SeatStatus };

/** Whether the seat lets the booking move to `step` now. A step without a seat rule needs no seat. */
export function checkMoveReadiness(step: BookingStatus, seat: { status: SeatStatus } | null): MoveReadiness {
  const follows = SEAT_FOLLOWS[step];

  if (!follows) return { ok: true };
  if (!seat) return { ok: false, code: "NO_SEAT", message: NO_SEAT_MESSAGE };
  if (seat.status !== follows.from) {
    return { ok: false, code: "SEAT_NOT_READY", message: seatNotReadyMessage(step), seat_status: seat.status };
  }

  return { ok: true };
}
