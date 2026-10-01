"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import {
  seatCategoryIdSchema,
  updateSeatCategorySchema,
} from "@/features/seat-categories/schemas/seat-category.schema";
import { findDuplicateSeatCategoryName } from "@/features/seat-categories/lib/find-duplicate-seat-category";
import {
  DUPLICATE_NAME_ERROR,
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  mapSeatCategoryError,
  type SeatCategoryActionError,
} from "@/features/seat-categories/lib/seat-category-errors";

export interface UpdateSeatCategoryActionResult {
  success: boolean;
  error?: SeatCategoryActionError;
}

/**
 * `updateSeatCategorySchema` has no `id`/`is_active`, so the body can
 * never change them. `.maybeSingle()` after the update turns "row missing
 * or hidden by RLS" into `NOT_FOUND`.
 */
export async function updateSeatCategoryAction(
  seatCategoryId: string,
  input: unknown,
): Promise<UpdateSeatCategoryActionResult> {
  await requirePermission("seat_categories:manage");

  const parsedId = seatCategoryIdSchema.safeParse(seatCategoryId);
  const parsed = updateSeatCategorySchema.safeParse(input);

  if (!parsedId.success || !parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();

  const duplicate = await findDuplicateSeatCategoryName(
    supabase,
    parsed.data.name,
    parsedId.data,
  );

  if (duplicate.error) {
    return { success: false, error: mapSeatCategoryError(duplicate.error) };
  }

  if (duplicate.duplicate) {
    return { success: false, error: DUPLICATE_NAME_ERROR };
  }

  const { data, error } = await supabase
    .from("seat_categories")
    .update(parsed.data)
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();

  if (error) {
    return { success: false, error: mapSeatCategoryError(error) };
  }

  if (!data) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  redirect(`/seat-categories/${parsedId.data}`);
}
