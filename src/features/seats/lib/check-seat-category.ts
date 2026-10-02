import type { PostgrestError } from "@supabase/supabase-js";

import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type SeatCategoryCheckResult =
  | { allowed: boolean; error?: undefined }
  | { allowed?: undefined; error: PostgrestError };

/**
 * Create: only an active category. Update: an active category, or the
 * seat's current one (so an already-inactive category does not block edits
 * to other fields). A missing category (or one RLS hides) is not
 * assignable; the FK (`23503`) stays the final guard.
 */
export async function checkSeatCategory(
  supabase: ServerSupabaseClient,
  categoryId: string,
  currentCategoryId?: string,
): Promise<SeatCategoryCheckResult> {
  const { data, error } = await supabase
    .from("seat_categories")
    .select("is_active")
    .eq("id", categoryId)
    .maybeSingle();

  if (error) {
    return { error };
  }

  return {
    allowed: !!data && (data.is_active || categoryId === currentCategoryId),
  };
}
