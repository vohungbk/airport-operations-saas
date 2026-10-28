import { createClient } from "@/lib/supabase/server";
import type { BarItem } from "@/lib/charts/bar-data";

/**
 * Server-only. The number of seats of each seat category, in one query (the count of the nested `seats`),
 * in the scope of the viewer's RLS. `null` when it could not be read: the card says so, and never shows
 * zeros in its place.
 */
export async function getStockByCategory(): Promise<BarItem[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("seat_categories")
      .select("name, seats(count)")
      .order("name", { ascending: true });

    if (error || !data) return null;

    return data.map((category) => ({
      label: category.name,
      value: category.seats[0]?.count ?? 0,
    }));
  } catch {
    return null;
  }
}
