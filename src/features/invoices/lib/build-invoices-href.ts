import type { InvoicesSortColumn, ResolvedInvoicesQuery } from "@/features/invoices/schemas/invoices-query.schema";

/**
 * Pure. An `/invoices` href that keeps every active filter, for the pagination (`page`), the page size
 * and the column sorting (`sort` and `order`, no `page`, so a new sort or size restarts at page 1).
 */
export function buildInvoicesHref(
  query: ResolvedInvoicesQuery,
  override: Partial<{ page: number; sort: InvoicesSortColumn; order: "asc" | "desc"; page_size: number }> = {},
): string {
  const next = { ...query, ...override };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.partner_id) params.set("partner_id", next.partner_id);
  params.set("sort", next.sort);
  params.set("order", next.order);
  params.set("page_size", String(next.page_size));
  if (override.page !== undefined) params.set("page", String(next.page));

  return `/invoices?${params.toString()}`;
}

/**
 * Pure. The address that downloads the list as CSV: the same filters and sort as the list on the screen, and
 * no page and no page size, because the file holds every invoice the filters match.
 */
export function buildInvoicesExportHref(query: ResolvedInvoicesQuery): string {
  const params = new URLSearchParams();

  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.partner_id) params.set("partner_id", query.partner_id);
  params.set("sort", query.sort);
  params.set("order", query.order);

  return `/api/invoices/export?${params.toString()}`;
}
