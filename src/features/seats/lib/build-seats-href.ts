import type { SeatsQuery } from "@/features/seats/schemas/seats-query.schema";

/**
 * Pure — builds a `/seats` href that keeps every active filter. Used by
 * pagination (`page`) and column sorting (`sort`/`order`, no `page`, so a
 * new sort restarts at page 1).
 */
export function buildSeatsHref(
  query: SeatsQuery,
  override: Partial<Pick<SeatsQuery, "page" | "sort" | "order">> = {},
): string {
  const next = { ...query, ...override };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.airport_id) params.set("airport_id", next.airport_id);
  if (next.category_id) params.set("category_id", next.category_id);
  if (next.status) params.set("status", next.status);
  params.set("sort", next.sort);
  params.set("order", next.order);
  if (override.page !== undefined) params.set("page", String(next.page));
  params.set("page_size", String(next.page_size));

  return `/seats?${params.toString()}`;
}
