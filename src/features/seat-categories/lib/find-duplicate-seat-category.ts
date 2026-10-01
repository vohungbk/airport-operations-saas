import type { PostgrestError } from "@supabase/supabase-js";

import type { createClient } from "@/lib/supabase/server";
import { escapeIlikeValue } from "@/features/seat-categories/lib/escape-ilike";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type DuplicateCheckResult =
  | { duplicate: boolean; error?: undefined }
  | { duplicate?: undefined; error: PostgrestError };

/**
 * Case-insensitive name check. `seat_categories.name` has no unique
 * constraint (plan decision A), so this app-level check is best effort
 * and can race under concurrent writes. `excludeId` lets an update keep
 * its own name.
 */
export async function findDuplicateSeatCategoryName(
  supabase: ServerSupabaseClient,
  name: string,
  excludeId?: string,
): Promise<DuplicateCheckResult> {
  let query = supabase
    .from("seat_categories")
    .select("id")
    .ilike("name", escapeIlikeValue(name));

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    return { error };
  }

  return { duplicate: (data?.length ?? 0) > 0 };
}
