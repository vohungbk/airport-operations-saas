import { z } from "zod";

import { INCIDENT_SEVERITIES } from "@/features/incidents/lib/incident-severity";
import { INCIDENT_STATUSES } from "@/features/incidents/lib/incident-status";
import {
  getIncidentSearchError,
  INCIDENT_SEARCH_MAX_LENGTH,
} from "@/features/incidents/lib/incident-search";

/**
 * Explicit column allowlist for the `sort` query param — never interpolate a
 * raw `searchParams` value into `.order()`.
 */
const INCIDENTS_SORT_COLUMNS = ["created_at", "severity", "status"] as const;

export type IncidentsSortColumn = (typeof INCIDENTS_SORT_COLUMNS)[number];

const INCIDENTS_DEFAULT_SORT: IncidentsSortColumn = "created_at";
const INCIDENTS_DEFAULT_PAGE_SIZE = 20;
const INCIDENTS_MAX_PAGE_SIZE = 100;

/**
 * `searchParams` is user-editable URL state: garbled values fall back to
 * safe defaults via `.catch()` instead of failing the page. An over-long `q`
 * is rejected by `parseIncidentsQuery` first, so it produces a visible error
 * rather than being dropped silently.
 */
export const incidentsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(INCIDENT_SEARCH_MAX_LENGTH)
    .optional()
    .catch(undefined),
  status: z.enum(INCIDENT_STATUSES).optional().catch(undefined),
  severity: z.enum(INCIDENT_SEVERITIES).optional().catch(undefined),
  sort: z.enum(INCIDENTS_SORT_COLUMNS).catch(INCIDENTS_DEFAULT_SORT),
  order: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).catch(1),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(INCIDENTS_MAX_PAGE_SIZE)
    .catch(INCIDENTS_DEFAULT_PAGE_SIZE),
});

export type IncidentsQuery = z.infer<typeof incidentsQuerySchema>;

export interface ParsedIncidentsQuery {
  query: IncidentsQuery;
  /** Message to show when `q` failed validation; the search is not applied then. */
  search_error: string | null;
}

export function parseIncidentsQuery(
  raw: Record<string, string | string[] | undefined>,
): ParsedIncidentsQuery {
  const rawQ = typeof raw.q === "string" ? raw.q : undefined;
  const search_error = rawQ === undefined ? null : getIncidentSearchError(rawQ);

  return {
    query: incidentsQuerySchema.parse({
      ...raw,
      q: search_error ? undefined : rawQ,
    }),
    search_error,
  };
}
