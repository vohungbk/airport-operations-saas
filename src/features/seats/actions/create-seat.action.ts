"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { createSeatSchema } from "@/features/seats/schemas/seat.schema";
import { checkSeatCategory } from "@/features/seats/lib/check-seat-category";
import { findDuplicateSeatSerial } from "@/features/seats/lib/find-duplicate-seat-serial";
import {
  DUPLICATE_SERIAL_ERROR,
  INACTIVE_CATEGORY_ERROR,
  VALIDATION_ERROR,
  mapSeatError,
  type SeatActionError,
} from "@/features/seats/lib/seat-errors";

export interface CreateSeatActionResult {
  success: boolean;
  error?: SeatActionError;
}

/**
 * Re-checks `seats:manage` server-side. The insert never carries
 * `public_token`, `status` or `rental_cycles` (DB defaults); the schema
 * strips any such keys from client input. The serial pre-check is only
 * for an early message — the UNIQUE constraint (`23505`) is the real guard.
 */
export async function createSeatAction(
  input: unknown,
): Promise<CreateSeatActionResult> {
  await requirePermission("seats:manage");

  const parsed = createSeatSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();

  const [duplicate, category] = await Promise.all([
    findDuplicateSeatSerial(supabase, parsed.data.serial_number),
    checkSeatCategory(supabase, parsed.data.category_id),
  ]);

  if (duplicate.error) {
    return { success: false, error: mapSeatError(duplicate.error) };
  }

  if (duplicate.duplicate) {
    return { success: false, error: DUPLICATE_SERIAL_ERROR };
  }

  if (category.error) {
    return { success: false, error: mapSeatError(category.error) };
  }

  if (!category.allowed) {
    return { success: false, error: INACTIVE_CATEGORY_ERROR };
  }

  const { data, error } = await supabase
    .from("seats")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: mapSeatError(error) };
  }

  redirect(`/seats/${data.id}`);
}
