import {
  PARTNERS_DEFAULT_ORDER,
  PARTNERS_DEFAULT_PAGE_SIZE,
  PARTNERS_DEFAULT_SORT,
  type PartnersQuery,
} from "@/features/partners/schemas/partners-query.schema";

/**
 * Address of the Partners list for a query with some fields changed. Only what differs from the
 * default goes in the address, so a clean list has a clean `/partners`.
 */
export function buildPartnersHref(
  query: PartnersQuery,
  change: Partial<PartnersQuery> = {},
): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  if (next.sort !== PARTNERS_DEFAULT_SORT) params.set("sort", next.sort);
  if (next.order !== PARTNERS_DEFAULT_ORDER) params.set("order", next.order);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.page_size !== PARTNERS_DEFAULT_PAGE_SIZE) {
    params.set("page_size", String(next.page_size));
  }

  const search = params.toString();
  return search ? `/partners?${search}` : "/partners";
}

/** A list is filtered when a search or a status narrows it; used to tell "none yet" from "none match". */
export function isPartnersFiltered(query: PartnersQuery): boolean {
  return Boolean(query.q || query.status);
}
