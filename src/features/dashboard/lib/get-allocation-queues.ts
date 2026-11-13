import { createClient } from "@/lib/supabase/server";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import { formatPickup } from "@/features/bookings/lib/booking-time";
import { JOB_STATUS_LABEL, type JobStatus } from "@/features/jobs/lib/job-status";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";
import type { BookingStatus } from "@/features/bookings/types";
import type { SeatStatus } from "@/features/seats/types";

const ALLOCATION_QUEUE_IDS = ["allocation", "installations", "cleaning", "inspection"] as const;

export type AllocationQueueId = (typeof ALLOCATION_QUEUE_IDS)[number];

export interface AllocationQueue {
  /** How many items the queue holds; 0 when it is empty. */
  count: number;
  /** The next item of the queue, or `null` when it is empty. */
  next: AllocationQueueItem | null;
}

export interface AllocationQueueItem {
  /** The booking, the job or the seat the row opens. */
  href: string;
  /** The next item as the design writes it, for example `BK-2026-000131 · Infant Carrier`. */
  label: string;
  /** The status in the words of the design (for example `New`). */
  status_label: string;
}

export type AllocationQueues = Record<AllocationQueueId, AllocationQueue>;

interface AllocationQueueRow {
  queue: string;
  total: number;
  item_id: string;
  title: string | null;
  detail: string | null;
  status: string;
  due_at: string | null;
  timezone: string | null;
}

const EMPTY_QUEUE: AllocationQueue = { count: 0, next: null };

function toItem(queue: AllocationQueueId, row: AllocationQueueRow): AllocationQueueItem {
  const deadline = row.due_at && row.timezone ? formatPickup(row.due_at, row.timezone, false) : null;
  const label = [row.title, row.detail, deadline].filter(Boolean).join(" · ");

  switch (queue) {
    case "allocation":
      return {
        href: `/bookings/${row.item_id}`,
        label,
        status_label: BOOKING_STATUS_LABEL[row.status as BookingStatus] ?? row.status,
      };
    case "installations":
      return {
        href: `/jobs/${row.item_id}`,
        label,
        status_label: JOB_STATUS_LABEL[row.status as JobStatus] ?? row.status,
      };
    default:
      return {
        href: `/seats/${row.item_id}`,
        label,
        status_label: SEAT_STATUS_LABEL[row.status as SeatStatus] ?? row.status,
      };
  }
}

/** A queue that has no row is empty (count 0), so the four queues are always there. */
export function toAllocationQueues(rows: readonly AllocationQueueRow[]): AllocationQueues {
  const queues = Object.fromEntries(
    ALLOCATION_QUEUE_IDS.map((id) => [id, EMPTY_QUEUE]),
  ) as AllocationQueues;

  for (const row of rows) {
    const queue = ALLOCATION_QUEUE_IDS.find((id) => id === row.queue);

    if (queue) {
      queues[queue] = { count: Number(row.total), next: toItem(queue, row) };
    }
  }

  return queues;
}

/**
 * Server-only. The seats to allocate, the installations due and the seats in cleaning and inspection of the
 * Command Centre (VI-F11-S03), each with its count and next item, read as the signed-in user so RLS is the
 * scope. A failed read gives `null` (a dash), never a count of 0 that says nothing is waiting.
 */
export async function getAllocationQueues(): Promise<AllocationQueues | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("command_centre_allocation_queues");

    return error || !data ? null : toAllocationQueues(data);
  } catch {
    return null;
  }
}
