import type { Database } from "@/types/database.types";

/**
 * Alias of the generated Supabase row type so this can never drift from
 * the schema (same pattern as `Airport`/`Partner`). Age bounds are in
 * months. There is no `code` or price column on `seat_categories`.
 */
export type SeatCategory =
  Database["public"]["Tables"]["seat_categories"]["Row"];
