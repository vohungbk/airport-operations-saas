import { escapeIlikeValue } from "@/features/seat-categories/lib/escape-ilike";
import type { SeatStatus } from "@/features/seats/types";
import type {
  SeatsQuery,
  SeatsSortColumn,
} from "@/features/seats/schemas/seats-query.schema";

export interface SeatsQueryFilters {
  /**
   * Ready-to-use PostgREST `.or()` filter string, or `undefined` when
   * there is no free-text search. The value is double-quoted so `,` `.`
   * `:` `(` `)` in user input cannot split or corrupt the filter.
   */
  search: string | undefined;
  airport_id: string | undefined;
  category_id: string | undefined;
  status: SeatStatus | undefined;
  sort: SeatsSortColumn;
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
 * Pure — turns a validated query into the shape `get-seats.ts` needs.
 * The airport/category/status filters combine with AND.
 */
export function buildSeatsQueryFilters(query: SeatsQuery): SeatsQueryFilters {
  const { q, airport_id, category_id, status, sort, order, page, page_size } =
    query;

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let search: string | undefined;
  if (q) {
    const pattern = toQuotedIlikePattern(q);
    search = `serial_number.ilike.${pattern},public_token.ilike.${pattern}`;
  }

  return {
    search,
    airport_id,
    category_id,
    status,
    sort,
    order,
    range: { from, to },
  };
}
