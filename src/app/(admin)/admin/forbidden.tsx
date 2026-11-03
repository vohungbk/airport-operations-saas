import { BoardAccessRestricted } from "@/features/workflow-board/components/board-access-restricted";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Shown by `forbidden()` (a 403) when the page of the Workflow Board is refused, inside the shell, as in the
 * Figma frames: the board header, one sentence and the way back. The page checks `dashboards:view` itself.
 */
export default async function WorkflowBoardForbidden() {
  const user = await getCurrentUser();

  return <BoardAccessRestricted role={user?.role ?? "partner_user"} />;
}
