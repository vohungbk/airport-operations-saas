import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { CHAIN_HISTORY_LIMIT, type ChainHistoryRow } from "@/features/return-queue/lib/chain-history";

export interface ChainHistoryResult {
  items: ChainHistoryRow[];
  truncated: boolean;
}

const EMPTY: ChainHistoryResult = { items: [], truncated: false };

const CHAIN_HISTORY_SELECT =
  "id, step, result, notes, photo_paths, completed_at, completed_by_user:users!return_chain_steps_completed_by_fkey(full_name), booking:bookings!return_chain_steps_booking_id_fkey(booking_number)";

/**
 * Server-only, read-only, newest first. The steps are append-only in the DB (FO-F08-S10, R9): the
 * seat page reads every booking of the seat, the booking page reads one booking. RLS lets only
 * admin and operations manager read them. Fetches one extra row to know whether older steps were cut off.
 */
export async function getChainHistory(
  scope: { seatId: string } | { bookingId: string },
): Promise<ChainHistoryResult> {
  const [column, id] =
    "seatId" in scope ? (["seat_id", scope.seatId] as const) : (["booking_id", scope.bookingId] as const);

  if (!z.guid().safeParse(id).success) {
    return EMPTY;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("return_chain_steps")
    .select(CHAIN_HISTORY_SELECT)
    .eq(column, id)
    .order("completed_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(CHAIN_HISTORY_LIMIT + 1);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as ChainHistoryRow[];

  return {
    items: rows.slice(0, CHAIN_HISTORY_LIMIT),
    truncated: rows.length > CHAIN_HISTORY_LIMIT,
  };
}
