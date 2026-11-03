import { getWorkflowBoard, type WorkflowBoard } from "@/features/workflow-board/lib/get-workflow-board";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";

/** Next.js uses errors with a `digest` for redirects, forbidden and not-found, and to opt in to dynamic rendering. */
function isFrameworkSignal(error: unknown): boolean {
  const digest = typeof error === "object" && error !== null ? (error as { digest?: unknown }).digest : undefined;
  return typeof digest === "string" && /^(NEXT_|DYNAMIC_SERVER_USAGE|BAILOUT)/.test(digest);
}

/**
 * Server-only. Reads the board, and gives `null` when the read fails so the page can keep its title and
 * filters and show an error with Retry (CO-F08-T01, AC10). The error is logged by its code only; the
 * person never sees it. A signal that Next.js itself throws is not a failure and goes on.
 */
export async function loadWorkflowBoard(query: WorkflowBoardQuery): Promise<WorkflowBoard | null> {
  try {
    return await getWorkflowBoard(query);
  } catch (error) {
    if (isFrameworkSignal(error)) throw error;

    const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
    console.error("Workflow board could not be read", { code: typeof code === "string" ? code : "unknown" });
    return null;
  }
}
