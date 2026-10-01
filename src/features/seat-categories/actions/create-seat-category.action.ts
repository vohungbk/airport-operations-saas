"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { createSeatCategorySchema } from "@/features/seat-categories/schemas/seat-category.schema";
import { findDuplicateSeatCategoryName } from "@/features/seat-categories/lib/find-duplicate-seat-category";
import {
  DUPLICATE_NAME_ERROR,
  VALIDATION_ERROR,
  mapSeatCategoryError,
  type SeatCategoryActionError,
} from "@/features/seat-categories/lib/seat-category-errors";

export interface CreateSeatCategoryActionResult {
  success: boolean;
  error?: SeatCategoryActionError;
}

/**
 * Re-checks `seat_categories:manage` server-side — never trust that the
 * page/layout guard already ran. Duplicate names are checked at app level
 * (case-insensitive) because the table has no unique constraint.
 */
export async function createSeatCategoryAction(
  input: unknown,
): Promise<CreateSeatCategoryActionResult> {
  await requirePermission("seat_categories:manage");

  const parsed = createSeatCategorySchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();

  const duplicate = await findDuplicateSeatCategoryName(
    supabase,
    parsed.data.name,
  );

  if (duplicate.error) {
    return { success: false, error: mapSeatCategoryError(duplicate.error) };
  }

  if (duplicate.duplicate) {
    return { success: false, error: DUPLICATE_NAME_ERROR };
  }

  const { data, error } = await supabase
    .from("seat_categories")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: mapSeatCategoryError(error) };
  }

  redirect(`/seat-categories/${data.id}`);
}
