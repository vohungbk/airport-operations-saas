import { createClient } from "@/lib/supabase/server";

export interface SeatLastWork {
  /** When it was done and how it ended. */
  at: string;
  outcome: "Success" | "Failed" | "Conditional pass";
}

export interface SeatLastWorkResult {
  cleaning: SeatLastWork | null;
  inspection: SeatLastWork | null;
}

/**
 * Server-only. The latest finished cleaning and the latest inspection of one seat, for the panel of the
 * job. RLS decides what the caller may read, so a person who cannot read the records gets `null`.
 */
export async function getSeatLastWork(seatId: string): Promise<SeatLastWorkResult> {
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

  if (cleaning.error) throw cleaning.error;
  if (inspection.error) throw inspection.error;

  return {
    cleaning:
      cleaning.data?.completed_at != null
        ? { at: cleaning.data.completed_at, outcome: cleaning.data.passed === false ? "Failed" : "Success" }
        : null,
    inspection: inspection.data
      ? {
          at: inspection.data.created_at,
          outcome:
            inspection.data.result === "fail"
              ? "Failed"
              : inspection.data.result === "conditional_pass"
                ? "Conditional pass"
                : "Success",
        }
      : null,
  };
}
