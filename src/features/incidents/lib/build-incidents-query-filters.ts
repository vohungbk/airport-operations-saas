import type { IncidentSeverity } from "@/features/incidents/lib/incident-severity";
import type { IncidentStatus } from "@/features/incidents/lib/incident-status";
import { escapeIlikeValue } from "@/features/seat-categories/lib/escape-ilike";
import type {
  IncidentsQuery,
  IncidentsSortColumn,
} from "@/features/incidents/schemas/incidents-query.schema";

export interface IncidentsQueryFilters {
  /**
   * Ready-to-use PostgREST `.or()` filter string, or `undefined` when there
   * is no free-text search. The value is double-quoted so `,` `.` `:` `(` `)`
   * in user input cannot split or corrupt the filter.
   */
  search: string | undefined;
  status: IncidentStatus | undefined;
  severity: IncidentSeverity | undefined;
  sort: IncidentsSortColumn;
  order: "asc" | "desc";
  range: { from: number; to: number };
}

/**
 * Two escaping layers, applied in order: first `ilike` wildcards (`%`, `_`,
 * `\`) so they match literally, then PostgREST quoted-value escaping for `\`
 * and `"`.
 */
function toQuotedIlikePattern(term: string): string {
  const likeEscaped = escapeIlikeValue(term);
  const quoteEscaped = likeEscaped.replace(/[\\"]/g, (char) => `\\${char}`);
  return `"%${quoteEscaped}%"`;
}

/** Pure — never imports Supabase; testable in isolation. */
export function buildIncidentsQueryFilters(
  query: IncidentsQuery,
): IncidentsQueryFilters {
  const { q, status, severity, sort, order, page, page_size } = query;

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let search: string | undefined;
  if (q) {
    const pattern = toQuotedIlikePattern(q);
    search = `type.ilike.${pattern},description.ilike.${pattern}`;
  }

  return { search, status, severity, sort, order, range: { from, to } };
}
