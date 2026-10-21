import { z } from "zod";

import { SEAT_STATUSES } from "@/features/seats/lib/seat-status";

/**
 * Explicit column allowlist for `/partner/seats`'s `sort` query param, never
 * a raw `searchParams` value in `.order()`.
 */
export const PARTNER_SEATS_SORT_COLUMNS = ["serial_number", "status"] as const;

export type PartnerSeatsSortColumn = (typeof PARTNER_SEATS_SORT_COLUMNS)[number];

export const PARTNER_SEATS_DEFAULT_SORT: PartnerSeatsSortColumn = "serial_number";
const PARTNER_SEATS_DEFAULT_ORDER = "asc";
export const PARTNER_SEATS_DEFAULT_PAGE = 1;
export const PARTNER_SEATS_DEFAULT_PAGE_SIZE = 20;
export const PARTNER_SEATS_MAX_PAGE_SIZE = 100;

/**
 * What the partner seats screen reads from the address (VI-F03-S04). There is
 * no partner, airport or category: the scope is the signed-in user's own and
 * comes from RLS, so those keys are dropped. Garbled values fall back to
 * safe defaults instead of failing the render.
 */
export const partnerSeatsQuerySchema = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  status: z.enum(SEAT_STATUSES).optional().catch(undefined),
  sort: z.enum(PARTNER_SEATS_SORT_COLUMNS).catch(PARTNER_SEATS_DEFAULT_SORT),
  order: z.enum(["asc", "desc"]).catch(PARTNER_SEATS_DEFAULT_ORDER),
  page: z.coerce.number().int().min(1).catch(PARTNER_SEATS_DEFAULT_PAGE),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(PARTNER_SEATS_MAX_PAGE_SIZE)
    .catch(PARTNER_SEATS_DEFAULT_PAGE_SIZE),
});

export type PartnerSeatsQuery = z.infer<typeof partnerSeatsQuerySchema>;
