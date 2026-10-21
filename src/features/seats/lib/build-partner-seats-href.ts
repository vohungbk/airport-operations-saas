import type { PartnerSeatsQuery } from "@/features/seats/schemas/partner-seats-query.schema";

/**
 * Pure. A `/partner/seats` href that keeps every active filter, for the
 * pagination (`page`) and the column sorting (`sort`/`order`, no `page`, so a
 * new sort restarts at page 1).
 */
export function buildPartnerSeatsHref(
  query: PartnerSeatsQuery,
  override: Partial<Pick<PartnerSeatsQuery, "page" | "sort" | "order">> = {},
): string {
  const next = { ...query, ...override };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  params.set("sort", next.sort);
  params.set("order", next.order);
  if (override.page !== undefined) params.set("page", String(next.page));
  params.set("page_size", String(next.page_size));

  return `/partner/seats?${params.toString()}`;
}
