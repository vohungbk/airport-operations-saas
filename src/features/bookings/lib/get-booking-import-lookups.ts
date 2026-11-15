import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface BookingImportLookups {
  /** The one airport the account sees, or `null` when it sees none or several. */
  airport: { id: string; timezone: string } | null;
  categoryIdsByName: Map<string, string>;
}

/**
 * Server-only. What the rows of an import are checked against (CO-F07-S03): the airport of the import
 * (the CSV has no airport column, so it is the one the account can see) and the seat categories in use.
 * RLS decides what is visible; there is no filter here for access.
 */
export async function getBookingImportLookups(supabase: ServerClient): Promise<BookingImportLookups> {
  const [airports, categories] = await Promise.all([
    supabase.from("airports").select("id, timezone"),
    supabase.from("seat_categories").select("id, name").eq("is_active", true),
  ]);

  for (const { error } of [airports, categories]) {
    if (error) throw error;
  }

  const visible = airports.data ?? [];

  return {
    airport: visible.length === 1 ? visible[0] : null,
    categoryIdsByName: new Map((categories.data ?? []).map((category) => [category.name.trim().toLowerCase(), category.id])),
  };
}
