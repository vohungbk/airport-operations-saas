import type { BookingStatus } from "@/features/bookings/types";
import { buildWorkflowBoardHref } from "@/features/workflow-board/lib/build-workflow-board-href";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";
import { TECHNICIAN_WORKFLOW_ROUTE } from "@/lib/constants/routes";
import { FIELD_STEPS } from "@/lib/workflow/board";

/**
 * The Workflow Board of a technician (CO-F08-T02). Only the steps a technician works in are active: the
 * field steps they move a booking to (En Route, Installed, Family Ready) and Technician Assigned, where
 * their own bookings wait for the move to En Route (AC04). Every other step is a read-only strip. Pure.
 */
export const TECHNICIAN_ACTIVE_STEPS = ["assigned", ...FIELD_STEPS] as const satisfies readonly BookingStatus[];

export function isTechnicianActiveStep(step: BookingStatus): boolean {
  return (TECHNICIAN_ACTIVE_STEPS as readonly BookingStatus[]).includes(step);
}

interface StepTotal {
  status: BookingStatus;
  total: number;
}

/**
 * The step the phone view shows: the one in the address when it is an active step, else the first active
 * step that has a booking, else the first active step. A step that is not active (or not a step at all)
 * in the address is ignored, so the address cannot open a read-only step.
 */
export function resolveSelectedStep(raw: string | string[] | undefined, columns: readonly StepTotal[]): BookingStatus {
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const requestedStep = TECHNICIAN_ACTIVE_STEPS.find((step) => step === requested);

  if (requestedStep) return requestedStep;

  const withBookings = TECHNICIAN_ACTIVE_STEPS.find(
    (step) => (columns.find((column) => column.status === step)?.total ?? 0) > 0,
  );

  return withBookings ?? TECHNICIAN_ACTIVE_STEPS[0];
}

/** The address of the technician board for the filters and, on a phone, the selected step. Pure. */
export function buildTechnicianBoardHref(query: WorkflowBoardQuery, step?: BookingStatus): string {
  const href = buildWorkflowBoardHref({ ...query, booking: undefined }, TECHNICIAN_WORKFLOW_ROUTE);

  if (!step) return href;

  return `${href}${href.includes("?") ? "&" : "?"}step=${step}`;
}
