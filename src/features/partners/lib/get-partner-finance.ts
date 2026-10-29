import { createClient } from "@/lib/supabase/server";
import {
  PARTNER_INVOICE_STATUSES,
  PARTNER_SETTLEMENT_STATUSES,
  type FinanceInvoice,
  type FinanceSettlement,
  type FinanceTerms,
  type InvoiceStatus,
  type PartnerFinanceData,
} from "@/features/partners/lib/partner-finance";

export const FINANCE_SETTLEMENT_SELECT = "period_start, gross_revenue, partner_share, final_amount";

export const FINANCE_INVOICE_SELECT =
  "id, invoice_number, issue_date, total, status, settlement:settlements(period_start)";

export const FINANCE_TERMS_SELECT =
  "partner_share_percent, launch_partner_share_percent, launch_mode, launch_credit_target, launch_credit_accumulated";

/** More than this many invoices on one page is not expected yet. */
export const FINANCE_INVOICES_LIMIT = 200;

interface InvoiceRow {
  id: string;
  invoice_number: string;
  issue_date: string;
  total: number;
  status: InvoiceStatus;
  settlement: { period_start: string } | null;
}

/**
 * Server-only, with the user's own client: RLS gives a partner user only the settlements, invoices
 * and terms of its own partner, so no partner id is sent from here. Only what a partner may see is
 * asked for: approved or paid settlements and issued, paid or overdue invoices. A failed read is
 * thrown, so the error boundary can offer a retry; it is never shown as an empty screen.
 */
export async function getPartnerFinance(): Promise<PartnerFinanceData> {
  const supabase = await createClient();

  const [settlements, invoices, terms] = await Promise.all([
    supabase
      .from("settlements")
      .select(FINANCE_SETTLEMENT_SELECT)
      .in("status", [...PARTNER_SETTLEMENT_STATUSES])
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select(FINANCE_INVOICE_SELECT)
      .in("status", [...PARTNER_INVOICE_STATUSES])
      .order("issue_date", { ascending: false })
      .limit(FINANCE_INVOICES_LIMIT),
    supabase
      .from("partner_commercial_terms")
      .select(FINANCE_TERMS_SELECT)
      // A version that starts in the future is not the terms in use yet.
      .lte("effective_from", new Date().toISOString().slice(0, 10))
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (settlements.error || invoices.error || terms.error) {
    throw new Error("Could not read the finance of the partner");
  }

  const rows = (invoices.data ?? []) as unknown as InvoiceRow[];

  return {
    settlement: settlements.data as FinanceSettlement | null,
    invoices: rows.map(
      ({ settlement, ...invoice }): FinanceInvoice => ({
        ...invoice,
        period_start: settlement?.period_start ?? null,
      }),
    ),
    terms: terms.data as FinanceTerms | null,
  };
}
