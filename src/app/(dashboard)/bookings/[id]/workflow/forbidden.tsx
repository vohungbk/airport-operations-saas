import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { WorkflowStateMessage } from "@/features/bookings/components/workflow-state-message";

/** A signed-in user who may not open the booking workflow. */
export default function BookingWorkflowForbidden() {
  return (
    <WorkflowStateMessage title="Booking" message="You do not have permission to view this booking.">
      <Link href="/bookings" className={buttonVariants({ variant: "outline" })}>
        Back to bookings
      </Link>
    </WorkflowStateMessage>
  );
}
