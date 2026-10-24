"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import {
  VALIDATION_ERROR,
  mapCommercialTermsError,
  type CommercialTermsActionError,
} from "@/features/partners/lib/commercial-terms-errors";
import { utcToday } from "@/features/partners/lib/commercial-terms";
import {
  createCommercialTermsSchema,
  partnerIdSchema,
} from "@/features/partners/schemas/commercial-terms.schema";

export interface SaveCommercialTermsActionResult {
  success: boolean;
  error?: CommercialTermsActionError;
}

/**
 * VI-F04-S01 (R1): saves new commercial terms as a new version with an effective date. The role
 * is checked here on the server before anything else (admin only; spec Q1 is open), the input is
 * validated with the same schema as the form, and the database function checks the caller again
 * and keeps the earlier versions. The earlier terms are never rewritten, so completed rentals
 * keep the terms they were calculated with.
 */
export async function saveCommercialTermsAction(
  partnerId: string,
  input: unknown,
): Promise<SaveCommercialTermsActionResult> {
  await requireRole([]);

  const parsedId = partnerIdSchema.safeParse(partnerId);
  const parsed = createCommercialTermsSchema(utcToday()).safeParse(input);

  if (!parsedId.success || !parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_partner_commercial_terms", {
    p_partner_id: parsedId.data,
    p_partner_share: parsed.data.partner_share_percent,
    p_launch_partner_share: parsed.data.launch_partner_share_percent,
    p_effective_from: parsed.data.effective_from,
  });

  if (error) {
    return { success: false, error: mapCommercialTermsError(error) };
  }

  revalidatePath(`/partners/${parsedId.data}/terms`);

  return { success: true };
}
