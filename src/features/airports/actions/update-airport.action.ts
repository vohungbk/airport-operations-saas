"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { updateAirportSchema } from "@/features/airports/schemas/airport.schema";
import {
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  mapAirportError,
  type AirportActionError,
} from "@/features/airports/lib/airport-errors";

export interface UpdateAirportActionResult {
  success: boolean;
  error?: AirportActionError;
}

/**
 * `updateAirportSchema` has no `code` field, so there is no path — not
 * even a disabled-input one — for this action to ever write a changed
 * `code` (see `airport.schema.ts`). `.maybeSingle()` after the update
 * distinguishes "row doesn't exist / RLS hid it" (`NOT_FOUND`) from a
 * real Postgres error, rather than treating both the same way.
 */
export async function updateAirportAction(
  airportId: string,
  input: unknown,
): Promise<UpdateAirportActionResult> {
  await requirePermission("airports:manage");

  const parsed = updateAirportSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("airports")
    .update(parsed.data)
    .eq("id", airportId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { success: false, error: mapAirportError(error) };
  }

  if (!data) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  redirect(`/airports/${airportId}`);
}
