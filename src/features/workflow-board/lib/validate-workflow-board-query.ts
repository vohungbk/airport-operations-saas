import {
  WORKFLOW_BOARD_FILTER_ERRORS,
  workflowBoardQuerySchema,
  type WorkflowBoardQuery,
  type WorkflowBoardQueryField,
} from "@/features/workflow-board/schemas/workflow-board-query.schema";

/**
 * A day is a calendar day at an airport (the cards show the pickup in the airport's own time), so a day
 * needs an airport. Without one, a booking near midnight would fall on a different day than its card shows.
 */
export const WORKFLOW_BOARD_DATE_NEEDS_AIRPORT_ERROR = "Choose an airport to filter by date.";

export type WorkflowBoardValidation =
  | { ok: true; query: WorkflowBoardQuery }
  | { ok: false; error: string };

/**
 * Checks the filters a person set in the filter bar with the schema the server uses. A field with no value
 * is left out. Pure, no I/O.
 */
export function validateWorkflowBoardQuery(
  next: Partial<Record<WorkflowBoardQueryField, string | undefined>>,
): WorkflowBoardValidation {
  const filled = Object.fromEntries(Object.entries(next).filter(([, value]) => value));
  const result = workflowBoardQuerySchema.safeParse(filled);

  if (!result.success) {
    const field = result.error.issues[0]?.path[0] as WorkflowBoardQueryField | undefined;
    return {
      ok: false,
      error: field ? WORKFLOW_BOARD_FILTER_ERRORS[field] : "Check the filters and try again.",
    };
  }

  if (result.data.date && !result.data.airport_id) {
    return { ok: false, error: WORKFLOW_BOARD_DATE_NEEDS_AIRPORT_ERROR };
  }

  return { ok: true, query: result.data };
}
