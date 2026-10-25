"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import {
  VALIDATION_ERROR,
  mapSettlementError,
  type SettlementActionResult,
} from "@/features/settlements/lib/settlement-errors";
import { monthToDate } from "@/features/settlements/lib/settlement";
import { createGenerateSettlementSchema } from "@/features/settlements/schemas/settlement.schema";

/**
 * VI-F04-S12 (R7): generates a draft settlement for a partner and a month. Only an admin may (the
 * check is here, before anything else, and again in the database function). The input is validated
 * with the same Zod schema as the form. On success the user is taken back to Settlements (NAV-5).
 */
export async function generateSettlementAction(input: unknown): Promise<SettlementActionResult> {
  await requireRole(["admin"]);

  const parsed = createGenerateSettlementSchema().safeParse(input);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path[0];
    return {
      success: false,
      error: {
        ...VALIDATION_ERROR,
        message: first?.message ?? VALIDATION_ERROR.message,
        field: field === "partner_id" || field === "month" ? field : undefined,
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_monthly_settlement", {
    p_partner_id: parsed.data.partner_id,
    p_month: monthToDate(parsed.data.month),
  });

  if (error) {
    return { success: false, error: mapSettlementError(error) };
  }

  revalidatePath("/settlements");
  redirect("/settlements");
}
