"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { changeSeatStatusSchema } from "@/features/seats/schemas/seat.schema";
import {
  VALIDATION_ERROR,
  mapSeatError,
  type SeatActionError,
} from "@/features/seats/lib/seat-errors";

export interface ChangeSeatStatusActionResult {
  success: boolean;
  error?: SeatActionError;
}

/**
 * Status changes go only through `public.change_seat_status()`, which
 * validates the transition under a row lock and (via trigger) writes the
 * history row atomically. Never a direct `update({ status })`.
 */
export async function changeSeatStatusAction(
  input: unknown,
): Promise<ChangeSeatStatusActionResult> {
  await requirePermission("seats:manage");

  const parsed = changeSeatStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_seat_status", {
    p_seat_id: parsed.data.seat_id,
    p_to_status: parsed.data.to_status,
    // The generated arg type is non-null; the function treats blank as no reason.
    p_reason: parsed.data.reason ?? "",
  });

  if (error) {
    return { success: false, error: mapSeatError(error) };
  }

  return { success: true };
}
