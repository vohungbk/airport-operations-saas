import type {
  AirportsQuery,
  AirportsSortColumn,
} from "@/features/airports/schemas/airports-query.schema";

export interface AirportsQueryFilters {
  /**
   * Ready-to-use PostgREST `.or()` filter string (e.g.
   * `"code.ilike.%term%,name.ilike.%term%,city.ilike.%term%"`), already
   * escaped, or `undefined` when there's no free-text search.
   * `get-airports.ts` calls `.or(filters.search)` verbatim when present —
   * it never rebuilds the filter string itself.
   */
  search: string | undefined;
  sort: AirportsSortColumn;
  order: "asc" | "desc";
  range: { from: number; to: number };
}

/**
 * PostgREST's `or=` filter syntax treats `,` as the separator between
 * conditions and `()` as grouping — a raw comma/parenthesis in user input
 * would silently split or corrupt the filter string instead of erroring,
 * so it must be escaped with a backslash before being interpolated (per
 * PostgREST's documented reserved characters: `,` `.` `:` `(` `)`, plus
 * the backslash escape character itself so an already-escaped input
 * can't be re-interpreted). Duplicated locally rather than imported from
 * `features/partners` per plan.md Task 5 — no cross-feature import.
 */
function escapePostgrestFilterValue(value: string): string {
  return value.replace(/[\\,.():]/g, (char) => `\\${char}`);
}

/**
 * Pure — converts a validated `AirportsQuery` (from
 * `airports-query.schema.ts`) into the shape `get-airports.ts` needs to
 * build its Supabase query. Never imports Supabase; testable in
 * isolation.
 */
export function buildAirportsQueryFilters(
  query: AirportsQuery,
): AirportsQueryFilters {
  const { q, sort, order, page, page_size } = query;

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let search: string | undefined;
  if (q) {
    const escaped = escapePostgrestFilterValue(q);
    const pattern = `%${escaped}%`;
    search = `code.ilike.${pattern},name.ilike.${pattern},city.ilike.${pattern}`;
  }

  return { search, sort, order, range: { from, to } };
}
