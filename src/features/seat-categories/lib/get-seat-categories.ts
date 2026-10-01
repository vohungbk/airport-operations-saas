import { createClient } from "@/lib/supabase/server";
import { buildSeatCategoriesQueryFilters } from "@/features/seat-categories/lib/build-seat-categories-query-filters";
import type { SeatCategoriesQuery } from "@/features/seat-categories/schemas/seat-categories-query.schema";
import type { SeatCategory } from "@/features/seat-categories/types";

export interface GetSeatCategoriesResult {
  seatCategories: SeatCategory[];
  total: number;
  /** Page actually returned; differs from the requested page when it was out of range. */
  page: number;
}

export const SEAT_CATEGORY_COLUMNS =
  "id, name, description, min_child_age, max_child_age, safety_standard, is_active, created_at, updated_at";

/** PostgREST error code for a `Range` offset past the last row (HTTP 416). */
const RANGE_NOT_SATISFIABLE = "PGRST103";

/**
 * Server-only. RLS is the access boundary; filters here are only for the
 * page's search/sort/pagination UI.
 */
export async function getSeatCategories(
  query: SeatCategoriesQuery,
): Promise<GetSeatCategoriesResult> {
  const supabase = await createClient();

  async function fetchPage(page: number) {
    const filters = buildSeatCategoriesQueryFilters({ ...query, page });

    let request = supabase
      .from("seat_categories")
      .select(SEAT_CATEGORY_COLUMNS, { count: "exact" })
      .order(filters.sort, { ascending: filters.order === "asc" })
      // Unique tie-breaker so ties on sort columns never repeat/skip rows across pages.
      .order("id", { ascending: true })
      .range(filters.range.from, filters.range.to);

    if (filters.search) {
      request = request.or(filters.search);
    }

    if (filters.is_active !== undefined) {
      request = request.eq("is_active", filters.is_active);
    }

    return request;
  }

  const first = await fetchPage(query.page);

  if (!first.error) {
    return {
      seatCategories: first.data ?? [],
      total: first.count ?? 0,
      page: query.page,
    };
  }

  if (first.error.code !== RANGE_NOT_SATISFIABLE || query.page === 1) {
    throw first.error;
  }

  // Requested page is past the last row (e.g. `?page=999`, or the last row
  // of the last page was deactivated out of a filter). The 416 response
  // carries no count, so count with a head request, then serve the last
  // valid page.
  const filters = buildSeatCategoriesQueryFilters({ ...query, page: 1 });
  let countRequest = supabase
    .from("seat_categories")
    .select("id", { count: "exact", head: true });

  if (filters.search) {
    countRequest = countRequest.or(filters.search);
  }

  if (filters.is_active !== undefined) {
    countRequest = countRequest.eq("is_active", filters.is_active);
  }

  const { count, error: countError } = await countRequest;

  if (countError) {
    throw countError;
  }

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / query.page_size));
  const retry = await fetchPage(lastPage);

  if (retry.error) {
    throw retry.error;
  }

  return { seatCategories: retry.data ?? [], total, page: lastPage };
}
