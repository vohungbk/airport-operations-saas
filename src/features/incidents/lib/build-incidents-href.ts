import type { IncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";

/**
 * Pure — the single place that serializes incident list state into a URL,
 * used by the filters, the table sort links and the pagination.
 * Overrides win over the current query.
 */
export function buildIncidentsHref(
  query: IncidentsQuery,
  overrides: Partial<IncidentsQuery> = {},
): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  if (next.severity) params.set("severity", next.severity);
  if (next.seat_id) params.set("seat_id", next.seat_id);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  params.set("sort", next.sort);
  params.set("order", next.order);
  params.set("page", String(next.page));
  params.set("page_size", String(next.page_size));

  return `/incidents?${params.toString()}`;
}
