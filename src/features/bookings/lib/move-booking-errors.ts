import type { PostgrestError } from "@supabase/supabase-js";

import { NO_SEAT_MESSAGE, seatNotReadyMessage } from "@/features/bookings/lib/booking-move";
import {
  NOT_FOUND_ERROR,
  mapBookingError,
  type BookingActionError,
} from "@/features/bookings/lib/booking-errors";
import { BOOKING_STATUSES, BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { BookingStatus } from "@/features/bookings/types";
import { SEAT_STATUSES } from "@/features/seats/lib/seat-status";
import type { SeatStatus } from "@/features/seats/types";

function asStatus<T extends string>(value: string | null | undefined, allowed: readonly T[]): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

/**
 * Turns an error of `move_booking_to_next_step()` into the message of the dialog (the wording of the
 * Figma frames). `step` is the step the person asked to move to. The current step and the seat status
 * come from the DETAIL of the error and are only used when they are a known value. Raw Postgres text
 * never reaches the client.
 *   BK007 changed by someone else, BK008 no seat, BK009 seat not ready, 42501 role not allowed,
 *   55000 the step cannot be skipped, P0002 not found; the rest as the other booking actions.
 */
export function mapMoveError(error: PostgrestError, step: BookingStatus): BookingActionError {
  switch (error.code) {
    case "BK007": {
      const current = asStatus<BookingStatus>(error.details, BOOKING_STATUSES);
      return {
        code: "STEP_CHANGED",
        message: current
          ? `Another user moved this booking. It is now in ${BOOKING_STATUS_LABEL[current]}.`
          : "Another user moved this booking.",
        current_step: current,
      };
    }
    case "BK008":
      return { code: "NO_SEAT", message: NO_SEAT_MESSAGE };
    case "BK009":
      return {
        code: "SEAT_NOT_READY",
        message: seatNotReadyMessage(step),
        seat_status: asStatus<SeatStatus>(error.details, SEAT_STATUSES),
      };
    case "42501":
      return {
        code: "FORBIDDEN",
        message: `Your role is not allowed to move this booking to ${BOOKING_STATUS_LABEL[step]}.`,
      };
    case "55000":
      return { code: "INVALID_TRANSITION", message: "This step cannot be skipped" };
    case "P0002":
      return NOT_FOUND_ERROR;
    default:
      return mapBookingError(error);
  }
}
