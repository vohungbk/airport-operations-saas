import { createClient } from "@/lib/supabase/server";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { AllocationQueue } from "@/features/dashboard/lib/get-allocation-queues";
import type { BookingStatus } from "@/features/bookings/types";

const ACTIVE_RETURNED_IDS = ["active", "returned"] as const;

type ActiveReturnedId = (typeof ACTIVE_RETURNED_IDS)[number];

export type ActiveReturned = Record<ActiveReturnedId, AllocationQueue>;

interface ActiveReturnedRow {
  queue: string;
  total: number;
  item_id: string;
  title: string | null;
  detail: string | null;
  status: string;
}

const EMPTY_QUEUE: AllocationQueue = { count: 0, next: null };

/** A queue that has no row is empty (count 0), so both queues are always there. */
export function toActiveReturned(rows: readonly ActiveReturnedRow[]): ActiveReturned {
  const queues = Object.fromEntries(
    ACTIVE_RETURNED_IDS.map((id) => [id, EMPTY_QUEUE]),
  ) as ActiveReturned;

  for (const row of rows) {
    const queue = ACTIVE_RETURNED_IDS.find((id) => id === row.queue);

    if (queue) {
      queues[queue] = {
        count: Number(row.total),
        next: {
          href: `/bookings/${row.item_id}`,
          label: [row.title, row.detail].filter(Boolean).join(" · "),
          status_label: BOOKING_STATUS_LABEL[row.status as BookingStatus] ?? row.status,
        },
      };
    }
  }

  return queues;
}

/**
 * Server-only. The active rentals and the returned seats of the Command Centre (VI-F11-S04), each with its
 * count and next item, read as the signed-in user so RLS is the scope. A failed read gives `null` (a dash),
 * never a count of 0 that says nothing is out.
 */
export async function getActiveReturned(): Promise<ActiveReturned | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("command_centre_active_returned");

    return error || !data ? null : toActiveReturned(data);
  } catch {
    return null;
  }
}
