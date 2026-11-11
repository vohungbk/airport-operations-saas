import type { JobsQuery } from "@/features/jobs/schemas/jobs-query.schema";

/**
 * Pure — the single place that serializes job list state into a URL,
 * used by the filters, table sort links and pagination. Overrides win
 * over the current query.
 */
export function buildJobsHref(
  query: JobsQuery,
  overrides: Partial<JobsQuery> = {},
): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  if (next.technician_id) params.set("technician_id", next.technician_id);
  if (next.deadline) params.set("deadline", next.deadline);
  if (next.type) params.set("type", next.type);
  if (next.airport_id) params.set("airport_id", next.airport_id);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.unassigned) params.set("unassigned", next.unassigned);
  params.set("sort", next.sort);
  params.set("order", next.order);
  params.set("page", String(next.page));
  params.set("page_size", String(next.page_size));

  return `/jobs?${params.toString()}`;
}
