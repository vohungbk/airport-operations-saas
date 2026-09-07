import { createClient } from "@/lib/supabase/server";
import type { Airport } from "@/features/airports/types";

const AIRPORT_COLUMNS =
  "id, code, name, city, country, timezone, created_at, updated_at";

/**
 * Server-only. Uses `.maybeSingle()` so a nonexistent id (or one an
 * RLS-restricted caller can't see) resolves to `null` — a normal,
 * expected outcome the caller turns into `notFound()`, never a thrown
 * error.
 */
export async function getAirportById(id: string): Promise<Airport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("airports")
    .select(AIRPORT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
