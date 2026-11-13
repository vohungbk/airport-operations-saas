import type { ActiveReturned } from "@/features/dashboard/lib/get-active-returned";
import type { AllocationQueue, AllocationQueues } from "@/features/dashboard/lib/get-allocation-queues";
import type { ArrivalQueues } from "@/features/dashboard/lib/get-arrival-queues";
import type { AttentionList } from "@/features/dashboard/lib/attention-list";

/** What a figure or a queue says when its source could not be read (VI-F11-S13, E3); the word of the metric tiles. */
export const UNAVAILABLE_TEXT = "Unavailable";

/**
 * The sources of the queues of the Command Centre. `null` is a read that failed; `undefined` is a source that was
 * not given, which is not a failure.
 */
export interface QueueSources {
  arrivalQueues?: ArrivalQueues | null;
  allocationQueues?: AllocationQueues | null;
  activeReturned?: ActiveReturned | null;
  quarantineQueue?: AllocationQueue | null;
  technicianAssignments?: AttentionList | null;
  overdueList?: AttentionList | null;
  openIncidents?: AttentionList | null;
}

/** The source each queue of the design is read from. */
const SOURCE_OF_QUEUE: Readonly<Record<string, keyof QueueSources>> = {
  "Today's arrivals": "arrivalQueues",
  "Upcoming bookings": "arrivalQueues",
  "Seats requiring allocation": "allocationQueues",
  "Installations due": "allocationQueues",
  "Active rentals": "activeReturned",
  "Returned seats": "activeReturned",
  "Cleaning queue": "allocationQueues",
  "Inspection queue": "allocationQueues",
  "Damaged or quarantined": "quarantineQueue",
  "Technician assignments": "technicianAssignments",
  "Overdue tasks": "overdueList",
  "Open incidents": "openIncidents",
};

/** Pure. A queue whose source failed says so; the others keep loading (E3). A queue with nothing in it is not a failure. */
export function isQueueUnavailable(queue: string, sources: QueueSources): boolean {
  const source = SOURCE_OF_QUEUE[queue];

  return source !== undefined && sources[source] === null;
}
