import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export interface PartnerSummary {
  name: string;
  code: string;
}

/**
 * Server-only. Reads the name and code of one partner, nothing else (no
 * contact or commercial data). RLS is the scope: a partner user can only see
 * the row of their own partner, so another partner's id gives `null`, the
 * same as an id that does not exist. A failed read is thrown, so the error
 * boundary can offer a retry; it is never turned into `null`.
 */
export async function getPartnerSummary(
  partnerId: string,
  supabase?: SupabaseClient<Database>,
): Promise<PartnerSummary | null> {
  const client = supabase ?? (await createClient());
  const { data, error } = await client
    .from("partners")
    .select("name, code")
    .eq("id", partnerId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not read the partner");
  }

  return data;
}
