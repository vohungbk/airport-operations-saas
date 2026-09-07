"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { createAirportSchema } from "@/features/airports/schemas/airport.schema";
import {
  VALIDATION_ERROR,
  mapAirportError,
  type AirportActionError,
} from "@/features/airports/lib/airport-errors";

export interface CreateAirportActionResult {
  success: boolean;
  error?: AirportActionError;
}

/**
 * Re-checks `airports:manage` server-side before touching the database —
 * never trust that the page/layout guard already ran, per
 * `backend.md`/`docs/security.md`'s defense-in-depth precedent from F04.
 * `code` uniqueness is enforced by the DB's unique constraint and mapped
 * from the resulting `23505` via `airport-errors.ts`, not pre-checked
 * here (see `airport.schema.ts`'s comment on the TOCTOU race that would
 * introduce).
 */
export async function createAirportAction(
  input: unknown,
): Promise<CreateAirportActionResult> {
  await requirePermission("airports:manage");

  const parsed = createAirportSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("airports")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: mapAirportError(error) };
  }

  redirect(`/airports/${data.id}`);
}
