import { SEAT_FOLLOWS, checkMoveReadiness } from "@/features/bookings/lib/booking-move";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";
import type { BookingStatus } from "@/features/bookings/types";
import type { SeatStatus } from "@/features/seats/types";

/**
 * CO-F08-T01 (Figma D4): the line under the Move button of a card that cannot move yet, for example
 * "Seat must be Available". Null when the seat lets the booking move to the step. The Move dialog says the same
 * thing in its own words; this is the short form for the card. Pure.
 */
export function getCardMoveNote(step: BookingStatus, seatStatus: SeatStatus | null): string | null {
  const readiness = checkMoveReadiness(step, seatStatus ? { status: seatStatus } : null);

  if (readiness.ok) return null;
  if (readiness.code === "NO_SEAT") return readiness.message;

  return `Seat must be ${SEAT_STATUS_LABEL[SEAT_FOLLOWS[step]?.from ?? "available"]}`;
}
