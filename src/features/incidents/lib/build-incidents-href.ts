import type { IncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";

/**
 * Pure — the single place that serializes incident list state into a URL,
 * used by the search form, the table sort links and the pagination.
 * Overrides win over the current query.
 */
export function buildIncidentsHref(
  query: IncidentsQuery,
  overrides: Partial<IncidentsQuery> = {},
): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  params.set("sort", next.sort);
  params.set("order", next.order);
  params.set("page", String(next.page));
  params.set("page_size", String(next.page_size));

  return `/incidents?${params.toString()}`;
}
