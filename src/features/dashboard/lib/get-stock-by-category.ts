import { createClient } from "@/lib/supabase/server";
import type { StockCategory } from "@/features/dashboard/lib/stock-rows";

/**
 * Server-only. For each seat category, the seats available now and all of its seats, in one query (the
 * counts of the nested `seats`), in the scope of the viewer's RLS. A category with no available seat still
 * comes back, with 0. `null` when it could not be read: the card says so, and never shows zeros in its place.
 */
export async function getStockByCategory(): Promise<StockCategory[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("seat_categories")
      .select("name, available:seats(count), total:seats(count)")
      .eq("available.status", "available")
      .order("name", { ascending: true });

    if (error || !data) return null;

    return data.map((category) => ({
      label: category.name,
      available: category.available[0]?.count ?? 0,
      total: category.total[0]?.count ?? 0,
    }));
  } catch {
    return null;
  }
}
