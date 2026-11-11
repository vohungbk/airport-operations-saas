import { createClient } from "@/lib/supabase/server";
import type { InspectionResult } from "@/features/inspections/schemas/record-inspection.schema";

const INSPECTION_HISTORY_LIMIT = 20;

export interface InspectionHistoryItem {
  id: string;
  result: InspectionResult;
  notes: string | null;
  created_at: string;
  inspector: string | null;
}

interface Row {
  id: string;
  result: InspectionResult;
  notes: string | null;
  created_at: string;
  recorder: { full_name: string } | null;
}

/**
 * Server-only. The past inspections of one seat, newest first, for the
 * history table. Records are never deleted, so the list only grows; it is
 * capped to keep the page light. RLS decides what the user may read.
 */
export async function getInspectionHistory(
  seatId: string,
): Promise<InspectionHistoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspection_records")
    .select("id, result, notes, created_at, recorder:users!inspector_id(full_name)")
    .eq("seat_id", seatId)
    .order("created_at", { ascending: false })
    .limit(INSPECTION_HISTORY_LIMIT);

  if (error) {
    throw error;
  }

  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    result: row.result,
    notes: row.notes,
    created_at: row.created_at,
    inspector: row.recorder?.full_name ?? null,
  }));
}
