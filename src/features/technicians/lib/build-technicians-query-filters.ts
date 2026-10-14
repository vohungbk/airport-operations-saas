import { escapeIlikeValue } from "@/features/seat-categories/lib/escape-ilike";
import type {
  TechniciansQuery,
  TechniciansSortColumn,
} from "@/features/technicians/schemas/technicians-query.schema";

export interface TechniciansQueryFilters {
  /**
   * Ready-to-use PostgREST `.or()` filter string, or `undefined` when
   * there is no free-text search. The value is double-quoted so `,` `.`
   * `:` `(` `)` in user input cannot split or corrupt the filter.
   */
  search: string | undefined;
  sort: TechniciansSortColumn;
  order: "asc" | "desc";
  range: { from: number; to: number };
}

/**
 * Two escaping layers, applied in order: first `ilike` wildcards (`%`,
 * `_`, `\`) so they match literally, then PostgREST quoted-value escaping
 * for `\` and `"`.
 */
function toQuotedIlikePattern(term: string): string {
  const likeEscaped = escapeIlikeValue(term);
  const quoteEscaped = likeEscaped.replace(/[\\"]/g, (char) => `\\${char}`);
  return `"%${quoteEscaped}%"`;
}

/** Pure — never imports Supabase; testable in isolation. */
export function buildTechniciansQueryFilters(
  query: TechniciansQuery,
): TechniciansQueryFilters {
  const { q, sort, order, page, page_size } = query;

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let search: string | undefined;
  if (q) {
    const pattern = toQuotedIlikePattern(q);
    search = `full_name.ilike.${pattern},email.ilike.${pattern}`;
  }

  return { search, sort, order, range: { from, to } };
}
