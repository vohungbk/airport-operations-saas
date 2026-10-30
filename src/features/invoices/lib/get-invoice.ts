import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { visibleInvoiceStatuses } from "@/features/invoices/lib/invoice-list";
import type { InvoiceDetailRow } from "@/features/invoices/lib/invoice-detail";

export const INVOICE_DETAIL_SELECT =
  "id, invoice_number, issue_date, due_date, subtotal, vat, total, status, partner:partners(name, code), settlement:settlements(period_start), lines:invoice_lines(position, description, amount, counts_toward_subtotal)";

interface Row extends Omit<InvoiceDetailRow, "period_start" | "lines"> {
  settlement: { period_start: string } | null;
  lines: InvoiceDetailRow["lines"] | null;
}

/**
 * Server-only. One invoice with its lines, with the user's own client: RLS gives a partner user only an invoice of its
 * own partner, and a partner is shown only an issued, paid or overdue one. An id that is malformed, does
 * not exist or is hidden is the same `null`, so nothing tells which of the three it was. A failed read is
 * thrown, never turned into `null`.
 */
export async function getInvoice(id: string, isPartner: boolean): Promise<InvoiceDetailRow | null> {
  if (!z.guid().safeParse(id).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_DETAIL_SELECT)
    .eq("id", id)
    .in("status", [...visibleInvoiceStatuses(isPartner)])
    .order("position", { referencedTable: "invoice_lines", ascending: true })
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { settlement, lines, ...invoice } = data as unknown as Row;

  return { ...invoice, period_start: settlement?.period_start ?? null, lines: lines ?? [] };
}
