import { createClient } from "@/lib/supabase/server";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";
import type { AllocationQueue } from "@/features/dashboard/lib/get-allocation-queues";
import type { SeatStatus } from "@/features/seats/types";

interface QuarantineQueueRow {
  queue: string;
  total: number;
  item_id: string;
  title: string | null;
  detail: string | null;
  status: string;
}

/** No row means no seat in quarantine: a count of 0 and no next item. */
export function toQuarantineQueue(rows: readonly QuarantineQueueRow[]): AllocationQueue {
  const row = rows.find((item) => item.queue === "quarantine");

  if (!row) return { count: 0, next: null };

  return {
    count: Number(row.total),
    next: {
      href: `/seats/${row.item_id}`,
      label: [row.title, row.detail].filter(Boolean).join(" · "),
      status_label: SEAT_STATUS_LABEL[row.status as SeatStatus] ?? row.status,
    },
  };
}

/**
 * Server-only. The seats damaged or in quarantine of the Command Centre (VI-F11-S05), with their count and
 * next seat, read as the signed-in user so RLS is the scope. A failed read gives `null` (a dash), never a
 * count of 0 that says no seat is set aside.
 */
export async function getQuarantineQueue(): Promise<AllocationQueue | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("command_centre_quarantine_queue");

    return error || !data ? null : toQuarantineQueue(data);
  } catch {
    return null;
  }
}
