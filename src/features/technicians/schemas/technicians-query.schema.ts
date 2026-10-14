import { z } from "zod";

import {
  getTechnicianSearchError,
  TECHNICIAN_SEARCH_MAX_LENGTH,
} from "@/features/technicians/lib/technician-search";

/**
 * Explicit column allowlist for the `sort` query param — never
 * interpolate a raw `searchParams` value into `.order()`.
 */
const TECHNICIANS_SORT_COLUMNS = ["full_name", "email", "created_at"] as const;

export type TechniciansSortColumn = (typeof TECHNICIANS_SORT_COLUMNS)[number];

const TECHNICIANS_DEFAULT_SORT: TechniciansSortColumn = "full_name";
const TECHNICIANS_DEFAULT_PAGE_SIZE = 20;
const TECHNICIANS_MAX_PAGE_SIZE = 100;

/**
 * `z.guid()` rather than `z.uuid()`: seeded ids are not RFC-variant
 * UUIDs (same choice as the other features' id schemas).
 */
export const technicianIdSchema = z.guid();

/**
 * `searchParams` is user-editable URL state — garbled sort/page values
 * fall back to safe defaults via `.catch()` instead of failing the page.
 * An over-long `q` is rejected by `parseTechniciansQuery` first, so it
 * produces a visible error rather than being dropped silently.
 */
export const techniciansQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(TECHNICIAN_SEARCH_MAX_LENGTH)
    .optional()
    .catch(undefined),
  sort: z.enum(TECHNICIANS_SORT_COLUMNS).catch(TECHNICIANS_DEFAULT_SORT),
  order: z.enum(["asc", "desc"]).catch("asc"),
  page: z.coerce.number().int().min(1).catch(1),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(TECHNICIANS_MAX_PAGE_SIZE)
    .catch(TECHNICIANS_DEFAULT_PAGE_SIZE),
});

export type TechniciansQuery = z.infer<typeof techniciansQuerySchema>;

export interface ParsedTechniciansQuery {
  query: TechniciansQuery;
  /** Message to show when `q` failed validation; the filter is not applied then. */
  search_error: string | null;
}

export function parseTechniciansQuery(
  raw: Record<string, string | string[] | undefined>,
): ParsedTechniciansQuery {
  const rawQ = typeof raw.q === "string" ? raw.q : undefined;
  const search_error = rawQ === undefined ? null : getTechnicianSearchError(rawQ);

  return {
    query: techniciansQuerySchema.parse({
      ...raw,
      q: search_error ? undefined : rawQ,
    }),
    search_error,
  };
}
