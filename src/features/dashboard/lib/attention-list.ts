import type { AllocationQueueItem } from "@/features/dashboard/lib/get-allocation-queues";

/** How many items a list of the Command Centre shows before it links to the full list (VI-F11-S08). */
export const ATTENTION_LIST_LIMIT = 5;

/** A row of a list: the same href, label and status as a queue item, plus the id that keys it. */
export interface AttentionListItem extends AllocationQueueItem {
  id: string;
}

export interface AttentionList {
  /** How many items the full list holds; 0 when it is empty. */
  count: number;
  /** The first items, at most {@link ATTENTION_LIST_LIMIT}, most urgent first. */
  items: readonly AttentionListItem[];
}
