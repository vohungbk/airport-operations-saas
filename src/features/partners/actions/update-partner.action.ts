"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { updatePartnerSchema } from "@/features/partners/schemas/partner.schema";
import {
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  mapPartnerError,
  type PartnerActionError,
} from "@/features/partners/lib/partner-errors";

export interface UpdatePartnerActionResult {
  success: boolean;
  error?: PartnerActionError;
}

/**
 * `updatePartnerSchema` has no `code` field, so there is no path — not
 * even a disabled-input one — for this action to ever write a changed
 * `code` (see `partner.schema.ts`). `.maybeSingle()` after the update
 * distinguishes "row doesn't exist / RLS hid it" (`NOT_FOUND`) from a
 * real Postgres error, rather than treating both the same way.
 */
export async function updatePartnerAction(
  partnerId: string,
  input: unknown,
): Promise<UpdatePartnerActionResult> {
  await requirePermission("partners:manage");

  const parsed = updatePartnerSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .update(parsed.data)
    .eq("id", partnerId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { success: false, error: mapPartnerError(error) };
  }

  if (!data) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  redirect(`/partners/${partnerId}`);
}
