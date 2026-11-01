import { WORKFLOW_BOARD_DATE_NEEDS_AIRPORT_ERROR } from "@/features/workflow-board/lib/validate-workflow-board-query";
import {
  WORKFLOW_BOARD_FILTER_ERRORS,
  parseWorkflowBoardQuery,
  type ParsedWorkflowBoardQuery,
} from "@/features/workflow-board/schemas/workflow-board-query.schema";

export interface WorkflowBoardOption {
  value: string;
  label: string;
}

export interface WorkflowBoardOptions {
  partners: WorkflowBoardOption[];
  airports: WorkflowBoardOption[];
}

/**
 * Parses the address and checks that a partner and an airport are among the listed options (the ones
 * the database lets this person see). An id that is well formed but not listed is dropped and reported
 * like any other value that is not valid; so is a day with no airport. Pure, no I/O.
 */
export function resolveWorkflowBoardQuery(
  raw: Record<string, string | string[] | undefined>,
  options: WorkflowBoardOptions,
): ParsedWorkflowBoardQuery {
  const { query, errors } = parseWorkflowBoardQuery(raw);
  const resolved = { ...query };

  if (resolved.partner_id && !options.partners.some((o) => o.value === resolved.partner_id)) {
    delete resolved.partner_id;
    errors.push(WORKFLOW_BOARD_FILTER_ERRORS.partner_id);
  }

  if (resolved.airport_id && !options.airports.some((o) => o.value === resolved.airport_id)) {
    delete resolved.airport_id;
    errors.push(WORKFLOW_BOARD_FILTER_ERRORS.airport_id);
  }

  // A day is read at an airport (see the message), so a day without one is dropped too.
  if (resolved.date && !resolved.airport_id) {
    delete resolved.date;
    errors.push(WORKFLOW_BOARD_DATE_NEEDS_AIRPORT_ERROR);
  }

  return { query: resolved, errors };
}
