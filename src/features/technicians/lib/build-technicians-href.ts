import type { TechniciansQuery } from "@/features/technicians/schemas/technicians-query.schema";

/**
 * Pure — the single place that serializes technician list state into a
 * URL, used by the filters, table sort links and pagination. Overrides
 * win over the current query; changing search or sort resets to page 1.
 */
export function buildTechniciansHref(
  query: TechniciansQuery,
  overrides: Partial<TechniciansQuery> = {},
): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  params.set("sort", next.sort);
  params.set("order", next.order);
  params.set("page", String(next.page));
  params.set("page_size", String(next.page_size));

  return `/technicians?${params.toString()}`;
}
