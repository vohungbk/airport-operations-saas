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
