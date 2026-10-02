import type { Database } from "@/types/database.types";

/**
 * Alias of the generated Supabase row type so this can never drift from
 * the schema (same pattern as `SeatCategory`/`Airport`).
 */
export type Seat = Database["public"]["Tables"]["seats"]["Row"];

export type SeatStatus = Database["public"]["Enums"]["seat_status"];

export type SeatHistoryEntry =
  Database["public"]["Tables"]["seat_status_history"]["Row"];
