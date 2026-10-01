"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { setSeatCategoryActiveSchema } from "@/features/seat-categories/schemas/seat-category.schema";
import {
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  mapSeatCategoryError,
  type SeatCategoryActionError,
} from "@/features/seat-categories/lib/seat-category-errors";

export interface SetSeatCategoryActiveActionResult {
  success: boolean;
  error?: SeatCategoryActionError;
}

/**
 * Soft activate/deactivate only — never a DELETE (no DELETE policy exists
 * and `seats`/`bookings` reference this table with ON DELETE RESTRICT).
 * Idempotent: setting the current value again succeeds.
 */
export async function setSeatCategoryActiveAction(
  input: unknown,
): Promise<SetSeatCategoryActiveActionResult> {
  await requirePermission("seat_categories:manage");

  const parsed = setSeatCategoryActiveSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seat_categories")
    .update({ is_active: parsed.data.is_active })
    .eq("id", parsed.data.seat_category_id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { success: false, error: mapSeatCategoryError(error) };
  }

  if (!data) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  return { success: true };
}
