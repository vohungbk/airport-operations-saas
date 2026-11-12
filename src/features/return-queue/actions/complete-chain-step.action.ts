"use server";

import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
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
 * and the booking. On success the user goes back to the Return queue (NAV-2).
 */
export async function completeChainStepAction(
  input: unknown,
): Promise<ChainStepActionResult> {
  await requirePermission("dashboards:view");

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
    return { success: false, error: mapChainStepError(error) };
  }

  redirect("/return-queue");
}
