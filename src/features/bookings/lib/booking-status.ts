import type { BookingStatus } from "@/features/bookings/types";

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const satisfies readonly BookingStatus[];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

/** Statuses that hold a seat for their period (seat overlap check). */
export const ACTIVE_BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "assigned",
  "in_progress",
] as const satisfies readonly BookingStatus[];

export const MANUAL_TARGET_STATUSES = [
  "confirmed",
  "cancelled",
  "no_show",
] as const satisfies readonly BookingStatus[];

export type ManualTargetStatus = (typeof MANUAL_TARGET_STATUSES)[number];

/** A reason is mandatory for these targets (stored as the event notes). */
export const REASON_REQUIRED_STATUSES = [
  "cancelled",
  "no_show",
] as const satisfies readonly ManualTargetStatus[];

/**
 * Minimal manual (admin/ops) transition table. `assigned`, `in_progress`
 * and `completed` belong to later workflows, so they have no manual
 * transitions and are never a manual target. Must stay in sync with
 * `public.change_booking_status()`, which is the enforcing authority.
 */
export const MANUAL_STATUS_TRANSITIONS: Record<
  BookingStatus,
  ManualTargetStatus[]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["cancelled", "no_show"],
  assigned: [],
  in_progress: [],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function getAllowedManualTransitions(
  status: BookingStatus,
): ManualTargetStatus[] {
  return MANUAL_STATUS_TRANSITIONS[status];
}

export function isReasonRequired(status: BookingStatus): boolean {
  return (REASON_REQUIRED_STATUSES as readonly BookingStatus[]).includes(
    status,
  );
}

const EDITABLE_STATUSES: readonly BookingStatus[] = ["pending", "confirmed"];

/** Terminal and workflow-owned bookings are view-only. */
export function isBookingEditable(status: BookingStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}
