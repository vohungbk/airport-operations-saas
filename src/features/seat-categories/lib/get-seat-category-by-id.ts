import { createClient } from "@/lib/supabase/server";
import { SEAT_CATEGORY_COLUMNS } from "@/features/seat-categories/lib/get-seat-categories";
import { seatCategoryIdSchema } from "@/features/seat-categories/schemas/seat-category.schema";
import type { SeatCategory } from "@/features/seat-categories/types";

/**
 * Server-only. Returns `null` for an unknown id, an id RLS hides, or a
 * malformed (non-uuid) id — the caller turns that into `notFound()`.
 */
export async function getSeatCategoryById(
  id: string,
): Promise<SeatCategory | null> {
  if (!seatCategoryIdSchema.safeParse(id).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seat_categories")
    .select(SEAT_CATEGORY_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
