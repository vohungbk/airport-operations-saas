"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import {
  buildUpdateSeatSchema,
  seatIdSchema,
} from "@/features/seats/schemas/seat.schema";
import { checkSeatCategory } from "@/features/seats/lib/check-seat-category";
import {
  INACTIVE_CATEGORY_ERROR,
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  mapSeatError,
  type SeatActionError,
} from "@/features/seats/lib/seat-errors";

export interface UpdateSeatActionResult {
  success: boolean;
  error?: SeatActionError;
}

const SEAT_RETIRED_ERROR: SeatActionError = {
  code: "INVALID_TRANSITION",
  message: "Retired seats cannot be edited.",
};

/**
 * The schema has no `serial_number`, `status`, `rental_cycles` or
 * `public_token`, so the body can never change them. The seat is read
 * first for the `retired` guard and the `max_rental_cycles >= current
 * rental_cycles` rule; the update repeats `status <> retired` so a
 * concurrent retire cannot slip through. `.maybeSingle()` turns "row
 * missing or hidden by RLS" into `NOT_FOUND`.
 */
export async function updateSeatAction(
  seatId: string,
  input: unknown,
): Promise<UpdateSeatActionResult> {
  await requirePermission("seats:manage");

  const parsedId = seatIdSchema.safeParse(seatId);

  if (!parsedId.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();

  const { data: seat, error: seatError } = await supabase
    .from("seats")
    .select("id, status, rental_cycles, category_id")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (seatError) {
    return { success: false, error: mapSeatError(seatError) };
  }

  if (!seat) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  if (seat.status === "retired") {
    return { success: false, error: SEAT_RETIRED_ERROR };
  }

  const parsed = buildUpdateSeatSchema(seat.rental_cycles).safeParse(input);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];

    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          firstIssue?.path[0] === "max_rental_cycles"
            ? firstIssue.message
            : VALIDATION_ERROR.message,
      },
    };
  }

  const category = await checkSeatCategory(
    supabase,
    parsed.data.category_id,
    seat.category_id,
  );

  if (category.error) {
    return { success: false, error: mapSeatError(category.error) };
  }

  if (!category.allowed) {
    return { success: false, error: INACTIVE_CATEGORY_ERROR };
  }

  const { data, error } = await supabase
    .from("seats")
    .update(parsed.data)
    .eq("id", parsedId.data)
    .neq("status", "retired")
    .select("id")
    .maybeSingle();

  if (error) {
    return { success: false, error: mapSeatError(error) };
  }

  if (!data) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  redirect(`/seats/${parsedId.data}`);
}
