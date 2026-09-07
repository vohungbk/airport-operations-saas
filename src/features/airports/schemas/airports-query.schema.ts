import { z } from "zod";

/**
 * Explicit column allowlist for `/airports`'s `sort` query param — never
 * interpolate a raw `searchParams` value into Supabase's `.order()`.
 * Matches `backend.md`'s "validate all external input with Zod" rule
 * applied to a query string instead of a Server Action/Route Handler
 * body. Column set + default per plan.md's "Quyết định đã chốt" #4.
 */
export const AIRPORTS_SORT_COLUMNS = [
  "code",
  "name",
  "city",
  "country",
  "created_at",
] as const;

export type AirportsSortColumn = (typeof AIRPORTS_SORT_COLUMNS)[number];

export const AIRPORTS_DEFAULT_SORT: AirportsSortColumn = "code";
export const AIRPORTS_DEFAULT_ORDER = "asc";
export const AIRPORTS_DEFAULT_PAGE = 1;
export const AIRPORTS_DEFAULT_PAGE_SIZE = 20;
export const AIRPORTS_MAX_PAGE_SIZE = 100;

/**
 * `searchParams` is user-editable URL state, not a trusted API body — an
 * out-of-range page or a garbled sort value falls back to a safe default
 * via `.catch()` instead of failing the whole page render (unlike
 * `airport.schema.ts`'s Server Action schemas, which do treat invalid
 * input as a hard failure). No `status` field — `airports` has no status
 * column, unlike `partners`.
 */
export const airportsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .optional()
    .catch(undefined),
  sort: z.enum(AIRPORTS_SORT_COLUMNS).catch(AIRPORTS_DEFAULT_SORT),
  order: z.enum(["asc", "desc"]).catch(AIRPORTS_DEFAULT_ORDER),
  page: z.coerce.number().int().min(1).catch(AIRPORTS_DEFAULT_PAGE),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(AIRPORTS_MAX_PAGE_SIZE)
    .catch(AIRPORTS_DEFAULT_PAGE_SIZE),
});

export type AirportsQuery = z.infer<typeof airportsQuerySchema>;
