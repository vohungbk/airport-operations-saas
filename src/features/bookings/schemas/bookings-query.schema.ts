import { z } from "zod";

import { BOOKING_STATUSES } from "@/features/bookings/lib/booking-status";

/**
 * Explicit column allowlist for `/bookings`'s `sort` query param — never
 * interpolate a raw `searchParams` value into `.order()`.
 */
export const BOOKINGS_SORT_COLUMNS = [
  "booking_number",
  "pickup_at",
  "return_at",
  "status",
  "created_at",
] as const;

export type BookingsSortColumn = (typeof BOOKINGS_SORT_COLUMNS)[number];

export const BOOKINGS_DEFAULT_SORT: BookingsSortColumn = "created_at";
const BOOKINGS_DEFAULT_ORDER = "desc";
export const BOOKINGS_DEFAULT_PAGE = 1;
export const BOOKINGS_DEFAULT_PAGE_SIZE = 20;
export const BOOKINGS_MAX_PAGE_SIZE = 100;

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
    );
  })
  .optional()
  .catch(undefined);

/**
 * `searchParams` is user-editable URL state — garbled values fall back to
 * safe defaults via `.catch()` instead of failing the page render.
 * `date_from` / `date_to` filter `pickup_at` (inclusive days).
 */
export const bookingsQuerySchema = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  airport_id: z.guid().optional().catch(undefined),
  status: z.enum(BOOKING_STATUSES).optional().catch(undefined),
  date_from: dateParam,
  date_to: dateParam,
  sort: z.enum(BOOKINGS_SORT_COLUMNS).catch(BOOKINGS_DEFAULT_SORT),
  order: z.enum(["asc", "desc"]).catch(BOOKINGS_DEFAULT_ORDER),
  page: z.coerce.number().int().min(1).catch(BOOKINGS_DEFAULT_PAGE),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(BOOKINGS_MAX_PAGE_SIZE)
    .catch(BOOKINGS_DEFAULT_PAGE_SIZE),
});

export type BookingsQuery = z.infer<typeof bookingsQuerySchema>;
