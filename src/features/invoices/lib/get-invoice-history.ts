import { createClient } from "@/lib/supabase/server";
import { historyYears, type InvoiceHistoryRow } from "@/features/invoices/lib/invoice-history";
import { visibleInvoiceStatuses } from "@/features/invoices/lib/invoice-list";
import type { InvoiceHistoryQuery } from "@/features/invoices/schemas/invoice-history-query.schema";

export interface InvoiceHistoryOptions {
  /** The invoices the Invoice number field offers, in order of number. */
  invoices: Array<{ id: string; invoice_number: string }>;
  /** The years the Period field offers, newest first. */
  years: number[];
}

export interface InvoiceHistory extends InvoiceHistoryOptions {
  rows: InvoiceHistoryRow[];
}

/**
 * Server-only. The history of the invoices the caller may see, with the user's own client (VI-F09-S10). The events come from
 * `get_invoice_history()`, which decides the scope in the database (a partner user is not given the creation of a
 * draft or a move to void, and nobody is given another partner's invoice). The two fields are filled from the invoices
 * RLS lets the caller read, limited to the statuses the role may see. A failed read is thrown, never turned into an
 * empty history.
 */
export async function getInvoiceHistory(
  query: InvoiceHistoryQuery,
  isPartner: boolean,
  currentYear: number,
): Promise<InvoiceHistory> {
  const supabase = await createClient();

  const [events, invoices] = await Promise.all([
    supabase.rpc("get_invoice_history", { p_invoice_id: query.invoice_id, p_year: query.year }),
    supabase
      .from("invoices")
      .select("id, invoice_number, issue_date")
      .in("status", [...visibleInvoiceStatuses(isPartner)])
      .order("invoice_number", { ascending: true }),
  ]);

  if (events.error) {
    throw events.error;
  }

  if (invoices.error) {
    throw invoices.error;
  }

  return {
    rows: (events.data ?? []) as InvoiceHistoryRow[],
    invoices: invoices.data.map(({ id, invoice_number }) => ({ id, invoice_number })),
    years: historyYears(
      invoices.data.map((invoice) => invoice.issue_date),
      currentYear,
    ),
  };
}
