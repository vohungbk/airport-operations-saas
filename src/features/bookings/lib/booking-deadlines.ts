import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";
import { formatPickup } from "@/features/bookings/lib/booking-time";
import { formatStepDate, formatTimeInStep } from "@/features/bookings/lib/booking-step-history";
import type { BookingStatus } from "@/features/bookings/types";

/**
 * Step deadlines (CO-F08-S07, spec rule R8). The deadline of a step is the time by which the booking
 * has to have reached it, counted back from its pickup time. A booking is overdue when the deadline
 * of its next step has passed. The database holds the same rule (`booking_step_deadline_offset()`,
 * `booking_is_overdue()`) and an integration test checks this table against it. Pure, no I/O.
 *
 * The hours are the proposal for open question Q3 of the spec. Only Allocated, Technician Assigned and
 * Active Rental have a deadline; every other step has none.
 */
export const STEP_DEADLINE_HOURS: Partial<Record<BookingStatus, number>> = {
  confirmed: 24,
  assigned: 4,
  in_progress: 1,
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** The time by which a booking has to reach `step`; `null` for a step without a deadline. */
export function getStepDeadline(step: BookingStatus, pickupAt: string): Date | null {
  const hours = STEP_DEADLINE_HOURS[step];
  return hours === undefined ? null : new Date(new Date(pickupAt).getTime() - hours * HOUR_MS);
}

export interface NextStepDeadline {
  step: BookingStatus;
  deadline: Date;
}

/**
 * The deadline of the first step after `status` that has one; `null` when there is none (no step with a
 * deadline is left, or the booking is off the path). It is the earliest of the deadlines still to reach,
 * so it is the only one to check.
 */
export function getNextStepDeadline(status: BookingStatus, pickupAt: string): NextStepDeadline | null {
  const index = (BOOKING_BOARD_STEPS as readonly BookingStatus[]).indexOf(status);
  if (index === -1) return null;

  for (const step of BOOKING_BOARD_STEPS.slice(index + 1)) {
    const deadline = getStepDeadline(step, pickupAt);
    if (deadline) return { step, deadline };
  }

  return null;
}

/** The deadline itself is still on time; only after it has passed is the step missed. */
const isMissed = (deadline: Date, now: Date) => now.getTime() > deadline.getTime();

/** Overdue once the deadline of the next step has passed. */
export function isBookingOverdue(status: BookingStatus, pickupAt: string, now: Date): boolean {
  const next = getNextStepDeadline(status, pickupAt);
  return next !== null && isMissed(next.deadline, now);
}

/** Whole minutes (rounded up, at least 1) past the deadline of the next step; `null` when it is not overdue. */
export function getOverdueMinutes(status: BookingStatus, pickupAt: string, now: Date): number | null {
  const next = getNextStepDeadline(status, pickupAt);
  if (!next || !isMissed(next.deadline, now)) return null;

  return Math.max(1, Math.ceil((now.getTime() - next.deadline.getTime()) / MINUTE_MS));
}

/** "Overdue by 20 min" when the deadline of the next step has passed; `null` otherwise. */
export function buildOverdueLabel(status: BookingStatus, pickupAt: string, now: Date): string | null {
  const minutes = getOverdueMinutes(status, pickupAt, now);
  return minutes === null ? null : `Overdue by ${formatTimeInStep(minutes)}`;
}

export interface StepDeadlineView {
  /** The deadline of the next step in the timezone of the airport, for example "24 Oct 2026 · 14:55 GST". */
  dueLabel: string;
  /** "Overdue by 20 min"; `null` while the deadline has not passed. */
  overdueLabel: string | null;
}

/** What the booking screen shows about the next deadline; `null` when the next step has none. */
export function buildStepDeadlineView(
  status: BookingStatus,
  pickupAt: string,
  timeZone: string,
  now: Date,
): StepDeadlineView | null {
  const next = getNextStepDeadline(status, pickupAt);
  if (!next) return null;

  const iso = next.deadline.toISOString();
  return {
    dueLabel: `${formatStepDate(iso, timeZone)} · ${formatPickup(iso, timeZone, false)}`,
    overdueLabel: buildOverdueLabel(status, pickupAt, now),
  };
}
