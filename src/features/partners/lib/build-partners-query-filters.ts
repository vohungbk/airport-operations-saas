import type { PartnerStatus } from "@/features/partners/types";
import type {
  PartnersQuery,
  PartnersSortColumn,
} from "@/features/partners/schemas/partners-query.schema";

export interface PartnersQueryFilters {
  /**
   * Ready-to-use PostgREST `.or()` filter string (e.g.
   * `"name.ilike.%term%,code.ilike.%term%"`), already escaped, or
   * `undefined` when there's no free-text search. `get-partners.ts` calls
   * `.or(filters.search)` verbatim when present — it never rebuilds the
   * filter string itself.
   */
  search: string | undefined;
  status: PartnerStatus | undefined;
  sort: PartnersSortColumn;
  order: "asc" | "desc";
  range: { from: number; to: number };
}

/**
 * PostgREST's `or=` filter syntax treats `,` as the separator between
 * conditions and `()` as grouping — a raw comma/parenthesis in user input
 * would silently split or corrupt the `name.ilike...,code.ilike...`
 * filter instead of erroring, so it must be escaped with a backslash
 * before being interpolated (per PostgREST's documented reserved
 * characters: `,` `.` `:` `(` `)`, plus the backslash escape character
 * itself so an already-escaped input can't be re-interpreted).
 */
function escapePostgrestFilterValue(value: string): string {
  return value.replace(/[\\,.():]/g, (char) => `\\${char}`);
}

/**
 * Pure — converts a validated `PartnersQuery` (from
 * `partners-query.schema.ts`) into the shape `get-partners.ts` needs to
 * build its Supabase query. Never imports Supabase; testable in
 * isolation.
 */
export function buildPartnersQueryFilters(
  query: PartnersQuery,
): PartnersQueryFilters {
  const { q, status, sort, order, page, page_size } = query;

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let search: string | undefined;
  if (q) {
    const escaped = escapePostgrestFilterValue(q);
    const pattern = `%${escaped}%`;
    search = `name.ilike.${pattern},code.ilike.${pattern}`;
  }

  return { search, status, sort, order, range: { from, to } };
}
