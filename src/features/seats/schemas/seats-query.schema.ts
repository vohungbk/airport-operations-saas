import { z } from "zod";

import { SEAT_STATUSES } from "@/features/seats/lib/seat-status";

/**
 * Explicit column allowlist for `/seats`'s `sort` query param — never
 * interpolate a raw `searchParams` value into `.order()`.
 */
export const SEATS_SORT_COLUMNS = [
  "serial_number",
  "status",
  "created_at",
] as const;

export type SeatsSortColumn = (typeof SEATS_SORT_COLUMNS)[number];

export const SEATS_DEFAULT_SORT: SeatsSortColumn = "created_at";
const SEATS_DEFAULT_ORDER = "desc";
export const SEATS_DEFAULT_PAGE = 1;
export const SEATS_DEFAULT_PAGE_SIZE = 20;
export const SEATS_MAX_PAGE_SIZE = 100;

/**
 * `searchParams` is user-editable URL state — garbled values fall back to
 * safe defaults via `.catch()` instead of failing the page render.
 */
export const seatsQuerySchema = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  airport_id: z.guid().optional().catch(undefined),
  category_id: z.guid().optional().catch(undefined),
  status: z.enum(SEAT_STATUSES).optional().catch(undefined),
  sort: z.enum(SEATS_SORT_COLUMNS).catch(SEATS_DEFAULT_SORT),
  order: z.enum(["asc", "desc"]).catch(SEATS_DEFAULT_ORDER),
  page: z.coerce.number().int().min(1).catch(SEATS_DEFAULT_PAGE),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(SEATS_MAX_PAGE_SIZE)
    .catch(SEATS_DEFAULT_PAGE_SIZE),
});

export type SeatsQuery = z.infer<typeof seatsQuerySchema>;
