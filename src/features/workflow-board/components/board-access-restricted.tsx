import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { WorkflowStateMessage } from "@/features/bookings/components/workflow-state-message";
import type { Role } from "@/lib/auth/roles";
import { TECHNICIAN_HOME_ROUTE } from "@/lib/constants/routes";

interface BoardAccessRestrictedProps {
  role: Role;
}

/**
 * The permission denied state of the Workflow Board (CO-F08-S09, as in the Figma frames): the page header,
 * one sentence and the way back. A partner user goes back to its bookings, a technician to their jobs.
 * The sentence is the same for every role and does not say what the board holds.
 */
export function BoardAccessRestricted({ role }: BoardAccessRestrictedProps) {
  const back =
    role === "technician"
      ? { href: TECHNICIAN_HOME_ROUTE, label: "Back to Today's Jobs" }
      : { href: "/bookings", label: "Back to My bookings" };

  return (
    <WorkflowStateMessage
      title="Workflow Board"
      subtitle="Access restricted"
      message="You do not have permission to view this board."
    >
      <Link href={back.href} className={buttonVariants({ variant: "outline", className: "min-h-11" })}>
        {back.label}
      </Link>
    </WorkflowStateMessage>
  );
}
