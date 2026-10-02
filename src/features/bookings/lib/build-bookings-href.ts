import type { BookingsQuery } from "@/features/bookings/schemas/bookings-query.schema";

/**
 * Builds a `/bookings` href that keeps every active filter. Used by
 * pagination (`page`) and column sorting (`sort`/`order`, no `page`, so a
 * new sort restarts at page 1).
 */
export function buildBookingsHref(
  query: BookingsQuery,
  override: Partial<Pick<BookingsQuery, "page" | "sort" | "order">> = {},
): string {
  const next = { ...query, ...override };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.airport_id) params.set("airport_id", next.airport_id);
  if (next.status) params.set("status", next.status);
  if (next.date_from) params.set("date_from", next.date_from);
  if (next.date_to) params.set("date_to", next.date_to);
  params.set("sort", next.sort);
  params.set("order", next.order);
  if (override.page !== undefined) params.set("page", String(next.page));
  params.set("page_size", String(next.page_size));

  return `/bookings?${params.toString()}`;
}
