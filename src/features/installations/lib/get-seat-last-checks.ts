import { createClient } from "@/lib/supabase/server";

export interface SeatLastChecks {
  /** The last cleaning that was completed: when, and whether it passed (`null`: not recorded). */
  last_cleaning: { at: string; passed: boolean | null } | null;
  /** The last inspection: when, and its result. */
  last_inspection: { at: string; result: string } | null;
}

/**
 * Server-only. The last cleaning and the last inspection of a seat, two small reads in parallel, in the
 * scope of the viewer's RLS. A read that fails gives `null` for that check: it is shown as a dash, never as
 * a pass.
 */
export async function getSeatLastChecks(seatId: string): Promise<SeatLastChecks> {
  const supabase = await createClient();
  const [cleaning, inspection] = await Promise.all([
    supabase
      .from("cleaning_records")
      .select("completed_at, passed")
      .eq("seat_id", seatId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("inspection_records")
      .select("created_at, result")
      .eq("seat_id", seatId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const cleaned = cleaning.error ? null : cleaning.data;
  const inspected = inspection.error ? null : inspection.data;

  return {
    last_cleaning:
      cleaned?.completed_at != null
        ? { at: cleaned.completed_at, passed: cleaned.passed }
        : null,
    last_inspection: inspected
      ? { at: inspected.created_at, result: inspected.result }
      : null,
  };
}
