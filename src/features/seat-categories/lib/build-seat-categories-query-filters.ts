import { escapeIlikeValue } from "@/features/seat-categories/lib/escape-ilike";
import type {
  SeatCategoriesQuery,
  SeatCategoriesSortColumn,
} from "@/features/seat-categories/schemas/seat-categories-query.schema";

export interface SeatCategoriesQueryFilters {
  /**
   * Ready-to-use PostgREST `.or()` filter string, or `undefined` when
   * there is no free-text search. The value is double-quoted so `,` `.`
   * `:` `(` `)` in user input cannot split or corrupt the filter.
   */
  search: string | undefined;
  is_active: boolean | undefined;
  sort: SeatCategoriesSortColumn;
  order: "asc" | "desc";
  range: { from: number; to: number };
}

/**
 * Two escaping layers, applied in order: first `ilike` wildcards (so `%`
 * and `_` match literally), then PostgREST's quoted-value escaping for
 * `\` and `"`.
 */
function toQuotedIlikePattern(term: string): string {
  const likeEscaped = escapeIlikeValue(term);
  const quoteEscaped = likeEscaped.replace(/[\\"]/g, (char) => `\\${char}`);
  return `"%${quoteEscaped}%"`;
}

/**
 * Pure — turns a validated query into the shape `get-seat-categories.ts`
 * needs. Never imports Supabase.
 */
export function buildSeatCategoriesQueryFilters(
  query: SeatCategoriesQuery,
): SeatCategoriesQueryFilters {
  const { q, status, sort, order, page, page_size } = query;

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let search: string | undefined;
  if (q) {
    const pattern = toQuotedIlikePattern(q);
    search = `name.ilike.${pattern},safety_standard.ilike.${pattern}`;
  }

  const is_active = status === undefined ? undefined : status === "active";

  return { search, is_active, sort, order, range: { from, to } };
}
