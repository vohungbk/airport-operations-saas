import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/features/partners/types";

const PARTNER_COLUMNS =
  "id, name, code, contact_email, status, created_at, updated_at";

/**
 * Server-only. Uses `.maybeSingle()` so a nonexistent id (or one an
 * RLS-restricted caller can't see) resolves to `null` — a normal,
 * expected outcome the caller turns into `notFound()`, never a thrown
 * error.
 */
export async function getPartnerById(id: string): Promise<Partner | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
