"use server";

import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePartnerScope } from "@/lib/auth/current-user";
import { toBaselineRpcArgs } from "@/features/roi/lib/baseline-inputs";
import {
  VALIDATION_ERROR,
  mapBaselineInputsError,
  type BaselineInputsActionError,
} from "@/features/roi/lib/baseline-inputs-errors";
import { baselineInputsSchema } from "@/features/roi/schemas/baseline-inputs.schema";
import { PARTNER_BASELINE_ROUTE, PARTNER_ROI_ROUTE } from "@/lib/constants/routes";

export type SaveBaselineInputsActionResult = { success: true } | { success: false; error: BaselineInputsActionError };

/**
 * VI-F05-S05 (R7): saves the baseline inputs of the signed-in partner. The permission is checked here on
 * the server before anything else, the input is validated with the same schema as the form, and the
 * database function checks the caller again. When the database refuses the caller (the permission was
 * revoked while the form was open), the action ends in the forbidden state, as the server check does
 * (VI-F05-S12, E8). The partner is never an argument: the function saves for
 * the partner of the signed-in user, so no one can write the baseline of another partner.
 */
export async function saveBaselineInputsAction(input: unknown): Promise<SaveBaselineInputsActionResult> {
  await requirePartnerScope("bookings:manage_own_partner");

  const parsed = baselineInputsSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_partner_baseline_inputs", toBaselineRpcArgs(parsed.data));

  if (error?.code === "42501") {
    forbidden();
  }

  if (error) {
    return { success: false, error: mapBaselineInputsError(error) };
  }

  revalidatePath(PARTNER_ROI_ROUTE);
  revalidatePath(PARTNER_BASELINE_ROUTE);

  return { success: true };
}
