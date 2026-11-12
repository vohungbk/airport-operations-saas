import type { ReturnQueueQuery } from "@/features/return-queue/schemas/return-queue-query.schema";

/**
 * Pure: the single place that writes the queue state into a URL, used by the
 * filters, the step chips and the pagination. Overrides win over the query.
 */
export function buildReturnQueueHref(
  query: ReturnQueueQuery,
  overrides: Partial<ReturnQueueQuery> = {},
): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.step) params.set("step", next.step);
  if (next.airport_id) params.set("airport_id", next.airport_id);
  params.set("page", String(next.page));
  params.set("page_size", String(next.page_size));

  return `/return-queue?${params.toString()}`;
}
