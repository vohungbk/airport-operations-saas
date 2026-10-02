import { createClient } from "@/lib/supabase/server";
import { seatIdSchema } from "@/features/seats/schemas/seat.schema";
import type { SeatHistoryEntry } from "@/features/seats/types";

export type SeatHistoryItem = Pick<
  SeatHistoryEntry,
  "id" | "from_status" | "to_status" | "reason" | "created_at"
> & { changed_by_user: { full_name: string } | null };

export const SEAT_HISTORY_LIMIT = 100;

export interface SeatStatusHistoryResult {
  items: SeatHistoryItem[];
  truncated: boolean;
}

/**
 * Server-only, read-only, newest first. The log is append-only in the DB.
 * Fetches one extra row to know whether older changes were cut off.
 */
export async function getSeatStatusHistory(
  seatId: string,
): Promise<SeatStatusHistoryResult> {
  if (!seatIdSchema.safeParse(seatId).success) {
    return { items: [], truncated: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seat_status_history")
    .select(
      "id, from_status, to_status, reason, created_at, changed_by_user:users(full_name)",
    )
    .eq("seat_id", seatId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(SEAT_HISTORY_LIMIT + 1);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as SeatHistoryItem[];

  return {
    items: rows.slice(0, SEAT_HISTORY_LIMIT),
    truncated: rows.length > SEAT_HISTORY_LIMIT,
  };
}
