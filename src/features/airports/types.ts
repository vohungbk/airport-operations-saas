import type { Database } from "@/types/database.types";

/**
 * The single source of truth for `airports` row shape is the generated
 * Supabase types (`airports` table). Never hand-duplicate the columns
 * here — alias the generated type so this can never drift from the
 * schema, matching `Partner`'s pattern in `src/features/partners/types.ts`.
 * Unlike `partners`, `airports` has no status enum/column, so there is no
 * `AIRPORT_STATUSES`-equivalent constant here.
 */
export type Airport = Database["public"]["Tables"]["airports"]["Row"];
