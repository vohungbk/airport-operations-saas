import {
  BOOKING_STATUS_LABEL,
  MANUAL_STATUS_TRANSITIONS,
} from "@/features/bookings/lib/booking-status";
import type { BookingStatus } from "@/features/bookings/types";
import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";

/**
 * The fixed step order of a booking (CO-F08-S02): `BOOKING_BOARD_STEPS`, from `pending` (New) to
 * `completed`. `cancelled` and `no_show` are off the path. The database holds the same order
 * (`booking_step_order()` and the trigger `guard_bookings_step_order`) and has the last word; this
 * module gives the clear message before a change is sent.
 */

export type TransitionCheck = { ok: true } | { ok: false; message: string };

const label = (status: BookingStatus) => BOOKING_STATUS_LABEL[status];

function joinLabels(statuses: readonly BookingStatus[]): string {
  const labels = statuses.map(label);
  return labels.length <= 1 ? labels.join("") : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

function stepIndex(status: BookingStatus): number {
  return (BOOKING_BOARD_STEPS as readonly BookingStatus[]).indexOf(status);
}

/**
 * Whether a person may move a booking from `from` to `to` by hand, and if not, why. Pure, no I/O.
 * The steps after `confirmed` belong to the operations workflow, so they are not set by hand even
 * when they are the next step.
 */
export function checkStatusTransition(from: BookingStatus, to: BookingStatus): TransitionCheck {
  if (from === to) {
    return { ok: false, message: `The booking is already ${label(from)}.` };
  }

  if ((MANUAL_STATUS_TRANSITIONS[from] as readonly BookingStatus[]).includes(to)) {
    return { ok: true };
  }

  const fromIndex = stepIndex(from);
  const toIndex = stepIndex(to);

  if (fromIndex !== -1 && toIndex !== -1) {
    if (toIndex === fromIndex + 1) {
      return { ok: false, message: `${label(to)} is set by the operations workflow, not by hand.` };
    }

    if (toIndex > fromIndex + 1) {
      const skipped = BOOKING_BOARD_STEPS.slice(fromIndex + 1, toIndex);
      return {
        ok: false,
        message: `Cannot move a booking from ${label(from)} to ${label(to)}. ${joinLabels(skipped)} ${skipped.length === 1 ? "comes" : "come"} first.`,
      };
    }

    return { ok: false, message: `A booking cannot move back from ${label(from)} to ${label(to)}.` };
  }

  return { ok: false, message: `A booking that is ${label(from)} cannot move to ${label(to)}.` };
}
