import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { BookingStatus } from "@/features/bookings/types";

/**
 * Pure logic for the board parts (UI-F04-S04, spec R7). The parts only show what they are given.
 * The design also has a longer workflow list; a screen that uses it passes its own `BoardStep`.
 */

export interface BoardStep {
  /** 1-based position. */
  number: number;
  total: number;
  label: string;
}

/** The 13 steps of a booking that runs its course. `cancelled` and `no_show` are not steps. */
export const BOOKING_BOARD_STEPS = [
  "pending",
  "confirmed",
  "preparation",
  "ready",
  "assigned",
  "en_route",
  "installed",
  "family_ready",
  "in_progress",
  "returned",
  "cleaning",
  "inspection",
  "completed",
] as const satisfies readonly BookingStatus[];

/** The field steps: the technician assigned to a booking may move it to these (CO-F08-S05). */
export const FIELD_STEPS = ["en_route", "installed", "family_ready"] as const satisfies readonly BookingStatus[];

export function stepOf(status: BookingStatus): BoardStep | null {
  const index = (BOOKING_BOARD_STEPS as readonly BookingStatus[]).indexOf(status);
  if (index === -1) return null;
  return { number: index + 1, total: BOOKING_BOARD_STEPS.length, label: BOOKING_STATUS_LABEL[status] };
}

export type BoardPriority = "normal" | "high" | "urgent";

/** The short wording of a priority, as the card of the Workflow Board shows it. */
export const BOARD_PRIORITY_SHORT_LABEL: Record<BoardPriority, string> = {
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const BOARD_PRIORITY_LABEL: Record<BoardPriority, string> = {
  normal: "Normal priority",
  high: "High priority",
  urgent: "Urgent",
};
