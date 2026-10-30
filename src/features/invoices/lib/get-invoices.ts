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

/** The most rows an export holds, and the rows read at a time to build it. */
export const INVOICE_EXPORT_LIMIT = 10_000;
export const INVOICE_EXPORT_BATCH = 1000;

/** The value of a `like` pattern with the characters that mean something in it taken literally. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

interface Row extends Omit<InvoiceListRow, "period_start"> {
  settlement: { period_start: string } | null;
}

const toRows = (data: unknown): InvoiceListRow[] =>
  ((data ?? []) as unknown as Row[]).map(({ settlement, ...invoice }) => ({
    ...invoice,
    period_start: settlement?.period_start ?? null,
  }));

const usesPeriod = (query: ResolvedInvoicesQuery) => Boolean(query.from || query.to);

/**
 * The request of the list with its filters, which the page and the export share, so the export is always
 * the list that is on the screen. `select` is a runtime string so the same chain serves the rows and the
 * count-only request.
 */
function filteredRequest(
  client: SupabaseClient<Database>,
  query: ResolvedInvoicesQuery,
  isPartner: boolean,
  select: string,
  head: boolean,
) {
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

/** The columns that decide which rows a count has to join. */
const countSelect = (query: ResolvedInvoicesQuery) =>
  usesPeriod(query) ? "id, settlement:settlements!inner(period_start)" : "id";

function orderedRange(
  client: SupabaseClient<Database>,
  query: ResolvedInvoicesQuery,
  isPartner: boolean,
  from: number,
  size: number,
) {
  return (
    filteredRequest(client, query, isPartner, usesPeriod(query) ? INVOICE_LIST_SELECT_BY_PERIOD : INVOICE_LIST_SELECT, false)
      .order(SORT_COLUMN[query.sort], { ascending: query.order === "asc" })
      // Unique tie-breaker so ties never repeat or skip rows across pages.
      .order("id", { ascending: true })
      .range(from, from + size - 1)
  );
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
  const fetchPage = (page: number) => orderedRange(client, query, isPartner, (page - 1) * query.page_size, query.page_size);

  const first = await fetchPage(query.page);

  if (!first.error) {
    return { invoices: toRows(first.data), total: first.count ?? 0, page: query.page };
  }

  if (first.error.code !== RANGE_NOT_SATISFIABLE || query.page === 1) {
    throw first.error;
  }

  // Requested page is past the last row. The 416 response carries no count, so count with a head
  // request, then serve the last valid page.
  const { count, error: countError } = await filteredRequest(client, query, isPartner, countSelect(query), true);

  if (countError) {
    throw countError;
  }

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / query.page_size));
  const retry = await fetchPage(lastPage);

  if (retry.error) {
    throw retry.error;
  }

  return { invoices: toRows(retry.data), total, page: lastPage };
}

/** The list asked for is longer than an export holds. */
export class InvoiceExportTooLargeError extends Error {
  constructor(readonly total: number) {
    super(`Export of ${total} invoices is above the limit of ${INVOICE_EXPORT_LIMIT}`);
  }
}

/**
 * Server-only (VI-F09-S02). Every invoice the filters match, in the order of the list, not one page of it,
 * read in batches. The scope is the same as the list's: RLS, and the statuses a partner may see. An export
 * above the limit is refused, not cut, so a file never looks complete when it is not. A failed read is
 * thrown.
 */
export async function getInvoicesForExport(
  query: ResolvedInvoicesQuery,
  isPartner: boolean,
  supabase?: SupabaseClient<Database>,
): Promise<InvoiceListRow[]> {
  const client = supabase ?? (await createClient());

  const { count, error: countError } = await filteredRequest(client, query, isPartner, countSelect(query), true);

  if (countError) {
    throw countError;
  }

  const total = count ?? 0;

  if (total > INVOICE_EXPORT_LIMIT) {
    throw new InvoiceExportTooLargeError(total);
  }

  const invoices: InvoiceListRow[] = [];

  for (let from = 0; from < total; from += INVOICE_EXPORT_BATCH) {
    const batch = await orderedRange(client, query, isPartner, from, INVOICE_EXPORT_BATCH);

    if (batch.error) {
      throw batch.error;
    }

    invoices.push(...toRows(batch.data));
  }

  return invoices;
}
