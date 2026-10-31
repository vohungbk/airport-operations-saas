import { createClient } from "@/lib/supabase/server";
import type { SettlementPeriodRow } from "@/features/invoices/lib/invoice-periods";

/** More than this many settlements are not expected yet; the form shows the newest months of each partner. */
export const PERIODS_LIMIT = 500;

interface Row {
  partner_id: string;
  period_start: string;
  status: string;
  platform_share: number;
  fees: number;
  invoices: Array<{ id: string; status: string }> | null;
}

/**
 * Server-only (VI-F09-S06). The settlements of every partner with the invoice made from each (one that is not void), for
 * the months of the Generate invoice form. Read with the user's own client: RLS decides what an admin sees. A failed
 * read is thrown, so the error boundary can offer a retry.
 */
export async function getInvoiceablePeriods(): Promise<SettlementPeriodRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settlements")
    .select("partner_id, period_start, status, platform_share, fees, invoices(id, status)")
    .order("period_start", { ascending: false })
    .limit(PERIODS_LIMIT);

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as Row[]).map(({ invoices, ...settlement }) => ({
    ...settlement,
    invoice_id: invoices?.find((invoice) => invoice.status !== "void")?.id ?? null,
  }));
}
