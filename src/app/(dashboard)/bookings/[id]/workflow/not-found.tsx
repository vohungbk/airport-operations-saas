import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { WorkflowStateMessage } from "@/features/bookings/components/workflow-state-message";

/**
 * Shown for an unknown booking and for one RLS hides (another partner's): the two look the same on
 * purpose, so a partner learns nothing about bookings that are not theirs.
 */
export default function BookingWorkflowNotFound() {
  return (
    <WorkflowStateMessage title="Booking" message="Booking not found.">
      <Link href="/bookings" className={buttonVariants({ variant: "outline" })}>
        Back to bookings
      </Link>
    </WorkflowStateMessage>
  );
}
