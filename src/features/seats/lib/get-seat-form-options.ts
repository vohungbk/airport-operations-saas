import { createClient } from "@/lib/supabase/server";
import { seatIdSchema } from "@/features/seats/schemas/seat.schema";

export interface SeatFormOptions {
  airports: { value: string; label: string }[];
  categories: { value: string; label: string }[];
}

/**
 * Server-only dropdown data. Only active categories are offered, plus the
 * seat's current category on edit so an inactive one never renders blank.
 */
export async function getSeatFormOptions(
  currentCategoryId?: string,
): Promise<SeatFormOptions> {
  const supabase = await createClient();

  let categoriesRequest = supabase
    .from("seat_categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (currentCategoryId && seatIdSchema.safeParse(currentCategoryId).success) {
    categoriesRequest = categoriesRequest.or(
      `is_active.eq.true,id.eq.${currentCategoryId}`,
    );
  } else {
    categoriesRequest = categoriesRequest.eq("is_active", true);
  }

  const [airports, categories] = await Promise.all([
    supabase
      .from("airports")
      .select("id, code, name")
      .order("code", { ascending: true }),
    categoriesRequest,
  ]);

  if (airports.error) {
    throw airports.error;
  }

  if (categories.error) {
    throw categories.error;
  }

  return {
    airports: (airports.data ?? []).map((airport) => ({
      value: airport.id,
      label: `${airport.code} - ${airport.name}`,
    })),
    categories: (categories.data ?? []).map((category) => ({
      value: category.id,
      label: category.name,
    })),
  };
}
