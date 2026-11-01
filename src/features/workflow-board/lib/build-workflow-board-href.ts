import { WORKFLOW_BOARD_ROUTE } from "@/lib/constants/routes";
import {
  WORKFLOW_BOARD_QUERY_FIELDS,
  type WorkflowBoardQuery,
} from "@/features/workflow-board/schemas/workflow-board-query.schema";

/** The address of the board for the given filters; a field without a value is left out. Pure. */
export function buildWorkflowBoardHref(query: WorkflowBoardQuery): string {
  const params = new URLSearchParams();

  for (const field of WORKFLOW_BOARD_QUERY_FIELDS) {
    const value = query[field];
    if (value) params.set(field, value);
  }

  const search = params.toString();
  return search ? `${WORKFLOW_BOARD_ROUTE}?${search}` : WORKFLOW_BOARD_ROUTE;
}
