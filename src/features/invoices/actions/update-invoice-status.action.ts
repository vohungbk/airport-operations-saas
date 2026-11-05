"use server";

import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import {
  VALIDATION_ERROR,
  mapUpdateInvoiceStatusError,
  type UpdateInvoiceStatusResult,
} from "@/features/invoices/lib/invoice-errors";
import { updateInvoiceStatusSchema } from "@/features/invoices/schemas/update-invoice-status.schema";

/**
 * VI-F09-S08: moves the payment status of an invoice by hand. Only an admin may (the check is here, before anything
 * else, and again in the database function). The input is validated with Zod. `update_invoice_status()` checks that
 * the move is allowed, needs a reason for a void, and saves the change; finance history keeps who made it, when and
 * why.
 */
export async function updateInvoiceStatusAction(input: unknown): Promise<UpdateInvoiceStatusResult> {
  await requireRole(["admin"]);

  const parsed = updateInvoiceStatusSchema.safeParse(input);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];

    return {
      success: false,
      error: {
        ...VALIDATION_ERROR,
        message: issue?.message ?? VALIDATION_ERROR.message,
        ...(issue?.path[0] === "reason" ? { field: "reason" as const } : {}),
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_invoice_status", {
    p_invoice_id: parsed.data.invoice_id,
    p_to: parsed.data.status,
    ...(parsed.data.reason ? { p_reason: parsed.data.reason } : {}),
  });

  // The role was checked above; the database says it changed since. That is the forbidden state, not a message inside the form (E9).
  if (error?.code === "42501") {
    forbidden();
  }

  if (error || !data) {
    return { success: false, error: mapUpdateInvoiceStatusError(error ?? { code: "" }) };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${data.id}`);

  return { success: true, invoice: { id: data.id, invoice_number: data.invoice_number, status: data.status } };
}
