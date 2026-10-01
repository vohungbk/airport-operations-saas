import { createClient } from "@/lib/supabase/server";
import { seatCategoryIdSchema } from "@/features/seat-categories/schemas/seat-category.schema";

export interface SeatCategoryRelatedCounts {
  seats: number;
}

/**
 * Server-only. One `head: true` count query on `seats.category_id` per
 * detail-page render — not an N+1. Bookings are deliberately not counted
 * (out of scope for this feature).
 */
export async function getSeatCategoryRelatedCounts(
  seatCategoryId: string,
): Promise<SeatCategoryRelatedCounts> {
  // A malformed id would reach Postgres as a 22P02 error; there are no seats for it.
  if (!seatCategoryIdSchema.safeParse(seatCategoryId).success) {
    return { seats: 0 };
  }

  const supabase = await createClient();

  const { count, error } = await supabase
    .from("seats")
    .select("id", { count: "exact", head: true })
    .eq("category_id", seatCategoryId);

  if (error) {
    throw error;
  }

  return { seats: count ?? 0 };
}
