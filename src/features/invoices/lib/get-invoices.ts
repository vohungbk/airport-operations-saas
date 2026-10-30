import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import {
  visibleInvoiceStatuses,
  type InvoiceListRow,
} from "@/features/invoices/lib/invoice-list";
import type { ResolvedInvoicesQuery } from "@/features/invoices/schemas/invoices-query.schema";
import type { Database } from "@/types/database.types";

export interface GetInvoicesResult {
  invoices: InvoiceListRow[];
  total: number;
  /** Page actually returned; differs from the requested page when it was out of range. */
  page: number;
}

const LIST_COLUMNS = "id, invoice_number, issue_date, due_date, total, status, partner:partners(name, code)";
/** The period is the month of the settlement; an inner join is needed only when it filters. */
export const INVOICE_LIST_SELECT = `${LIST_COLUMNS}, settlement:settlements(period_start)`;
export const INVOICE_LIST_SELECT_BY_PERIOD = `${LIST_COLUMNS}, settlement:settlements!inner(period_start)`;

const SORT_COLUMN = {
  invoice_number: "invoice_number",
  period: "issue_date",
  amount: "total",
  due_date: "due_date",
} as const;

/** PostgREST error code for a `Range` offset past the last row (HTTP 416). */
const RANGE_NOT_SATISFIABLE = "PGRST103";

/** The value of a `like` pattern with the characters that mean something in it taken literally. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

interface Row extends Omit<InvoiceListRow, "period_start"> {
  settlement: { period_start: string } | null;
}

/**
 * Server-only. RLS is the scope: a partner user is given only the invoices of its own partner, so there
 * is no `partner_id` filter for the scope here (the one of the query is the operations user's filter, and
 * the page drops it for a partner). A partner is also shown only issued, paid and overdue invoices. A
 * failed read is thrown, so the error boundary can offer a retry; it is never shown as an empty list.
 */
export async function getInvoices(
  query: ResolvedInvoicesQuery,
  isPartner: boolean,
  supabase?: SupabaseClient<Database>,
): Promise<GetInvoicesResult> {
  const client = supabase ?? (await createClient());
  const byPeriod = Boolean(query.from || query.to);

  function filteredRequest(select: string, head: boolean) {
    let request = client
      .from("invoices")
      .select(select, { count: "exact", head })
      .in("status", [...visibleInvoiceStatuses(isPartner)]);

    if (query.q) request = request.ilike("invoice_number", `%${escapeLike(query.q)}%`);
    if (query.status) request = request.eq("status", query.status);
    if (query.partner_id) request = request.eq("partner_id", query.partner_id);
    if (query.from) request = request.gte("settlement.period_start", `${query.from}-01`);
    if (query.to) request = request.lte("settlement.period_start", `${query.to}-01`);

    return request;
  }

  function fetchPage(page: number) {
    const from = (page - 1) * query.page_size;

    return filteredRequest(byPeriod ? INVOICE_LIST_SELECT_BY_PERIOD : INVOICE_LIST_SELECT, false)
      .order(SORT_COLUMN[query.sort], { ascending: query.order === "asc" })
      // Unique tie-breaker so ties never repeat or skip rows across pages.
      .order("id", { ascending: true })
      .range(from, from + query.page_size - 1);
  }

  const toResult = (data: unknown, total: number, page: number): GetInvoicesResult => ({
    invoices: ((data ?? []) as unknown as Row[]).map(({ settlement, ...invoice }) => ({
      ...invoice,
      period_start: settlement?.period_start ?? null,
    })),
    total,
    page,
  });

  const first = await fetchPage(query.page);

  if (!first.error) {
    return toResult(first.data, first.count ?? 0, query.page);
  }

  if (first.error.code !== RANGE_NOT_SATISFIABLE || query.page === 1) {
    throw first.error;
  }

  // Requested page is past the last row. The 416 response carries no count, so count with a head
  // request, then serve the last valid page.
  const { count, error: countError } = await filteredRequest(
    byPeriod ? "id, settlement:settlements!inner(period_start)" : "id",
    true,
  );

  if (countError) {
    throw countError;
  }

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / query.page_size));
  const retry = await fetchPage(lastPage);

  if (retry.error) {
    throw retry.error;
  }

  return toResult(retry.data, total, lastPage);
}
