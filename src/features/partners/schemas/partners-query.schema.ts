import { z } from "zod";

import { PARTNER_STATUSES } from "@/features/partners/types";

/**
 * Explicit column allowlist for `/partners`'s `sort` query param — never
 * interpolate a raw `searchParams` value into Supabase's `.order()`.
 * Matches `backend.md`'s "validate all external input with Zod" rule
 * applied to a query string instead of a Server Action/Route Handler
 * body.
 */
export const PARTNERS_SORT_COLUMNS = [
  "name",
  "code",
  "status",
  "created_at",
] as const;

export type PartnersSortColumn = (typeof PARTNERS_SORT_COLUMNS)[number];

export const PARTNERS_DEFAULT_SORT: PartnersSortColumn = "created_at";
export const PARTNERS_DEFAULT_ORDER = "desc";
export const PARTNERS_DEFAULT_PAGE = 1;
export const PARTNERS_DEFAULT_PAGE_SIZE = 20;
export const PARTNERS_MAX_PAGE_SIZE = 100;

/**
 * `searchParams` is user-editable URL state, not a trusted API body — an
 * out-of-range page or a garbled sort/status value falls back to a safe
 * default via `.catch()` instead of failing the whole page render (unlike
 * `partner.schema.ts`'s Server Action schemas, which do treat invalid
 * input as a hard failure).
 */
export const partnersQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .optional()
    .catch(undefined),
  status: z.enum(PARTNER_STATUSES).optional().catch(undefined),
  sort: z.enum(PARTNERS_SORT_COLUMNS).catch(PARTNERS_DEFAULT_SORT),
  order: z.enum(["asc", "desc"]).catch(PARTNERS_DEFAULT_ORDER),
  page: z.coerce.number().int().min(1).catch(PARTNERS_DEFAULT_PAGE),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(PARTNERS_MAX_PAGE_SIZE)
    .catch(PARTNERS_DEFAULT_PAGE_SIZE),
});

export type PartnersQuery = z.infer<typeof partnersQuerySchema>;
