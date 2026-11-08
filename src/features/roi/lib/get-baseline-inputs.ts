import { createClient } from "@/lib/supabase/server";
import { baselineValuesOf, type BaselineValues } from "@/features/roi/lib/baseline-inputs";

/**
 * Server-only. Reads the baseline now in force for one partner, or `null` when none is saved yet (the
 * Empty state). RLS is the scope: a partner user can only read the row of their own partner, so another
 * partner's id gives `null`, the same as a partner with no baseline. A failed read is thrown, so the
 * error boundary can offer a retry; it is never turned into `null`.
 */
export async function getBaselineInputs(partnerId: string): Promise<BaselineValues | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("partner_baseline_inputs").select("*").eq("partner_id", partnerId).maybeSingle();

  if (error) {
    throw new Error("Could not read the baseline inputs");
  }

  return data ? baselineValuesOf(data) : null;
}
