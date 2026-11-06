import type { BookingStatus } from "@/features/bookings/types";

/**
 * Every status of a booking, in the order of the 13-step path (CO-F08), then the two that leave it.
 * Five ids keep their old name and have the name the design gives them: `pending` is New,
 * `confirmed` Allocated, `assigned` Technician Assigned, `in_progress` Active Rental and `completed`
 * Available. The database holds the same ids (`booking_step_order()`).
 */
export const BOOKING_STATUSES = [
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
  "cancelled",
  "no_show",
] as const satisfies readonly BookingStatus[];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "New",
  confirmed: "Allocated",
  preparation: "Preparation",
  ready: "Ready",
  assigned: "Technician Assigned",
  en_route: "En Route",
  installed: "Installed",
  family_ready: "Family Ready",
  in_progress: "Active Rental",
  returned: "Returned",
  cleaning: "Cleaning",
  inspection: "Inspection",
  completed: "Available",
  cancelled: "Cancelled",
  no_show: "No-show",
};

/** Statuses that hold a seat for their period (seat overlap check). */
/** A booking in one of these statuses has ended: it needs no flight refresh and no replanning. */
export const ENDED_BOOKING_STATUS_LIST = [
  "completed",
  "cancelled",
  "no_show",
] as const satisfies readonly BookingStatus[];

/** The same list as a filter value for a query: `(completed,cancelled,no_show)`. */
export const ENDED_BOOKING_STATUS_FILTER = `(${ENDED_BOOKING_STATUS_LIST.join(",")})`;

export const ACTIVE_BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "preparation",
  "ready",
  "assigned",
  "en_route",
  "installed",
  "family_ready",
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
 * Minimal manual (admin/ops) transition table. Every step after `confirmed`
 * belongs to the operations workflow, so it is never a manual target; a
 * booking at any step from `preparation` to `in_progress` can only be cancelled,
 * which releases its seat (CO-F08-S08). Must stay in sync with
 * `public.change_booking_status()`, which is the enforcing authority.
 */
export const MANUAL_STATUS_TRANSITIONS: Record<
  BookingStatus,
  ManualTargetStatus[]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["cancelled", "no_show"],
  preparation: ["cancelled"],
  ready: ["cancelled"],
  assigned: ["cancelled"],
  en_route: ["cancelled"],
  installed: ["cancelled"],
  family_ready: ["cancelled"],
  in_progress: ["cancelled"],
  returned: [],
  cleaning: [],
  inspection: [],
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

/**
 * A partner user may edit only a booking that is still `pending`: once
 * operations confirm it, changes go through them. Managers use
 * `isBookingEditable`. The database function checks the same rule.
 */
export function isPartnerBookingEditable(status: BookingStatus): boolean {
  return status === "pending";
}
