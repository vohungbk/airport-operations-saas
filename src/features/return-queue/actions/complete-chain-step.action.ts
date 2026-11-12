"use server";

import { forbidden, redirect } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { RETURN_CHAIN_STEP_PERMISSIONS } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { chainStepBackHref } from "@/features/return-queue/lib/chain-step-access";
import {
  CHAIN_STEP_VALIDATION_ERROR,
  mapChainStepError,
  type ChainStepActionResult,
} from "@/features/return-queue/lib/chain-step-errors";
import { completeChainStepSchema } from "@/features/return-queue/schemas/complete-chain-step.schema";

/**
 * Complete the current step of a seat's return chain (FO-F08-S02). The
 * database function checks the role, the step order, the rules and the
 * photos again, stores the step with the actor and time, and moves the seat
 * and the booking. On success the user goes back to the Return queue (NAV-2),
 * or a technician to their home (FO-F08-S08). The database lets a technician
 * act only on a booking assigned to them (R8, E6).
 */
export async function completeChainStepAction(
  input: unknown,
): Promise<ChainStepActionResult> {
  const user = await requireAnyPermission(RETURN_CHAIN_STEP_PERMISSIONS);

  const parsed = completeChainStepSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: CHAIN_STEP_VALIDATION_ERROR };
  }

  const { booking_id, step, result, checklist, notes, photo_paths } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_return_chain_step", {
    p_booking_id: booking_id,
    p_step: step,
    p_result: result,
    p_checklist: checklist,
    p_notes: notes || null,
    p_photo_paths: photo_paths,
  });

  if (error) {
    // The permission was lost after the screen opened (E9): show the forbidden state.
    if (error.code === "42501") {
      forbidden();
    }

    return { success: false, error: mapChainStepError(error) };
  }

  redirect(chainStepBackHref(user.role));
}
