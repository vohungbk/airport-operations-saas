"use server";

import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import {
  VALIDATION_ERROR,
  mapIssueInvoiceError,
  type IssueInvoiceResult,
} from "@/features/invoices/lib/invoice-errors";
import { issueInvoiceSchema } from "@/features/invoices/schemas/issue-invoice.schema";

/**
 * VI-F09-S07: issues a draft invoice. Only an admin may (the check is here, before anything else, and again in the
 * database function). The input is validated with Zod. `issue_invoice()` checks that the invoice is a draft, sets the
 * issue date to today, the due date to that day plus the payment terms of the partner, and the status to issued. The
 * answer holds the dates, so the screen can show them.
 */
export async function issueInvoiceAction(input: unknown): Promise<IssueInvoiceResult> {
  await requireRole(["admin"]);

  const parsed = issueInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: { ...VALIDATION_ERROR, message: parsed.error.issues[0]?.message ?? VALIDATION_ERROR.message },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_invoice", { p_invoice_id: parsed.data.invoice_id });

  // The role was checked above; the database says it changed since. That is the forbidden state, not a message inside the form (E9).
  if (error?.code === "42501") {
    forbidden();
  }

  if (error || !data) {
    return { success: false, error: mapIssueInvoiceError(error ?? { code: "" }) };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${data.id}`);

  return {
    success: true,
    invoice: { id: data.id, invoice_number: data.invoice_number, issue_date: data.issue_date, due_date: data.due_date },
  };
}
