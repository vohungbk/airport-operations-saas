"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { deactivatePartnerSchema } from "@/features/partners/schemas/partner.schema";
import {
  ALREADY_INACTIVE_ERROR,
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  mapPartnerError,
  type PartnerActionError,
} from "@/features/partners/lib/partner-errors";

export interface DeactivatePartnerActionResult {
  success: boolean;
  error?: PartnerActionError;
}

/**
 * Dedicated action for the soft-delete flow — only ever sets
 * `status = 'inactive'` for one `partner_id`, never a generic status
 * update (that's `updatePartnerAction`). Explicitly rejects an
 * already-inactive partner with `CONFLICT` instead of silently no-oping,
 * per plan.md's "Quyết định đã chốt" #4.
 *
 * The `status = 'inactive'` check and the update are one conditional
 * `UPDATE ... WHERE id = $1 AND status <> 'inactive'` statement, not a
 * separate `SELECT` followed by an `UPDATE` — two concurrent deactivate
 * calls against the same active partner would otherwise both read
 * `status: "active"` and both "succeed," instead of the second one being
 * correctly rejected as a conflict. `data` being `null` means either the
 * row doesn't exist or it was already inactive; only that path does one
 * follow-up existence check to tell the two apart.
 */
export async function deactivatePartnerAction(
  input: unknown,
): Promise<DeactivatePartnerActionResult> {
  await requirePermission("partners:manage");

  const parsed = deactivatePartnerSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const { partner_id } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("partners")
    .update({ status: "inactive" })
    .eq("id", partner_id)
    .neq("status", "inactive")
    .select("id")
    .maybeSingle();

  if (error) {
    return { success: false, error: mapPartnerError(error) };
  }

  if (data) {
    return { success: true };
  }

  const { data: existing, error: existsError } = await supabase
    .from("partners")
    .select("id")
    .eq("id", partner_id)
    .maybeSingle();

  if (existsError) {
    return { success: false, error: mapPartnerError(existsError) };
  }

  if (!existing) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  return { success: false, error: ALREADY_INACTIVE_ERROR };
}
