"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import {
  VALIDATION_ERROR,
  mapMoveSettlementError,
  type SettlementActionResult,
} from "@/features/settlements/lib/settlement-errors";
import { moveSettlementSchema } from "@/features/settlements/schemas/settlement.schema";

/**
 * VI-F04-S13 (R8): moves a settlement to another status. Only an admin may (checked here before
 * anything else, and again in the database function, which also checks that the move is allowed and
 * saves who made it and when). The input is validated with Zod. The list is refreshed on success.
 */
export async function moveSettlementStatusAction(input: unknown): Promise<SettlementActionResult> {
  await requireRole(["admin"]);

  const parsed = moveSettlementSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: { ...VALIDATION_ERROR, message: parsed.error.issues[0]?.message ?? VALIDATION_ERROR.message },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_settlement_status", {
    p_settlement_id: parsed.data.settlement_id,
    p_to: parsed.data.to_status,
  });

  if (error) {
    return { success: false, error: mapMoveSettlementError(error) };
  }

  revalidatePath("/settlements");
  return { success: true };
}
