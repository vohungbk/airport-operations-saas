import { z } from "zod";

/**
 * Explicit column allowlist for `/seat-categories`'s `sort` query param —
 * never interpolate a raw `searchParams` value into `.order()`.
 */
export const SEAT_CATEGORIES_SORT_COLUMNS = [
  "name",
  "min_child_age",
  "max_child_age",
  "safety_standard",
  "created_at",
] as const;

export type SeatCategoriesSortColumn =
  (typeof SEAT_CATEGORIES_SORT_COLUMNS)[number];

export const SEAT_CATEGORY_STATUSES = ["active", "inactive"] as const;

export type SeatCategoryStatusFilter = (typeof SEAT_CATEGORY_STATUSES)[number];

export const SEAT_CATEGORIES_DEFAULT_SORT: SeatCategoriesSortColumn = "name";
export const SEAT_CATEGORIES_DEFAULT_ORDER = "asc";
export const SEAT_CATEGORIES_DEFAULT_PAGE = 1;
export const SEAT_CATEGORIES_DEFAULT_PAGE_SIZE = 20;
export const SEAT_CATEGORIES_MAX_PAGE_SIZE = 100;

/**
 * `searchParams` is user-editable URL state — garbled values fall back to
 * safe defaults via `.catch()` instead of failing the page render.
 */
export const seatCategoriesQuerySchema = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  status: z.enum(SEAT_CATEGORY_STATUSES).optional().catch(undefined),
  sort: z
    .enum(SEAT_CATEGORIES_SORT_COLUMNS)
    .catch(SEAT_CATEGORIES_DEFAULT_SORT),
  order: z.enum(["asc", "desc"]).catch(SEAT_CATEGORIES_DEFAULT_ORDER),
  page: z.coerce.number().int().min(1).catch(SEAT_CATEGORIES_DEFAULT_PAGE),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(SEAT_CATEGORIES_MAX_PAGE_SIZE)
    .catch(SEAT_CATEGORIES_DEFAULT_PAGE_SIZE),
});

export type SeatCategoriesQuery = z.infer<typeof seatCategoriesQuerySchema>;
