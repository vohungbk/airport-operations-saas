"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import {
  VALIDATION_ERROR,
  mapInvoiceError,
  type GenerateInvoiceResult,
} from "@/features/invoices/lib/invoice-errors";
import { generateInvoiceSchema } from "@/features/invoices/schemas/generate-invoice.schema";
import { monthToDate } from "@/features/settlements/lib/settlement";

/**
 * VI-F09-S06: generates a draft invoice from the approved settlement of a partner and a month. Only an admin may (the
 * check is here, before anything else, and again in the database function). The input is validated with the same
 * Zod schema as the form. The invoice is made by `generate_invoice()`, which checks that the settlement is approved,
 * that no invoice exists for it, and gives the number. The answer holds the invoice, so the screen can show it.
 */
export async function generateInvoiceAction(input: unknown): Promise<GenerateInvoiceResult> {
  await requireRole(["admin"]);

  const parsed = generateInvoiceSchema.safeParse(input);

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
  const { data, error } = await supabase.rpc("generate_invoice", {
    p_partner_id: parsed.data.partner_id,
    p_month: monthToDate(parsed.data.month),
  });

  if (error || !data) {
    return { success: false, error: mapInvoiceError(error ?? { code: "" }) };
  }

  revalidatePath("/invoices");

  return { success: true, invoice: { id: data.id, invoice_number: data.invoice_number, total: data.total } };
}
