import { createClient } from "@/lib/supabase/server";
import { buildSeatsQueryFilters } from "@/features/seats/lib/build-seats-query-filters";
import type { SeatsQuery } from "@/features/seats/schemas/seats-query.schema";
import type { Seat } from "@/features/seats/types";

interface SeatRelations {
  category: { id: string; name: string } | null;
  airport: { id: string; code: string; name: string } | null;
}

/** Detail row: every seat column plus the joined category/airport. */
export type SeatDetailItem = Seat & SeatRelations;

/** List row: only the columns `seats-table.tsx` renders. */
export type SeatListItem = Pick<
  Seat,
  "id" | "public_token" | "serial_number" | "status" | "created_at"
> &
  SeatRelations;

export interface GetSeatsResult {
  seats: SeatListItem[];
  total: number;
  /** Page actually returned; differs from the requested page when it was out of range. */
  page: number;
}

const SEAT_RELATIONS_SELECT =
  "category:seat_categories(id, name), airport:airports(id, code, name)";

const SEAT_COLUMNS =
  "id, public_token, serial_number, manufacturer, model, category_id, airport_id, status, manufacture_date, purchase_date, rental_cycles, max_rental_cycles, last_cleaned_at, last_inspected_at, quarantine_reason, retired_at, created_at, updated_at";

/** One nested select — never a per-row lookup (no N+1). */
export const SEAT_WITH_RELATIONS_SELECT = `${SEAT_COLUMNS}, ${SEAT_RELATIONS_SELECT}`;

export const SEAT_LIST_SELECT = `id, public_token, serial_number, status, created_at, ${SEAT_RELATIONS_SELECT}`;

/** PostgREST error code for a `Range` offset past the last row (HTTP 416). */
const RANGE_NOT_SATISFIABLE = "PGRST103";

/**
 * Server-only. RLS is the access boundary; filters here are only for the
 * page's search/filter/sort/pagination UI.
 */
export async function getSeats(query: SeatsQuery): Promise<GetSeatsResult> {
  const supabase = await createClient();

  async function fetchPage(page: number) {
    const filters = buildSeatsQueryFilters({ ...query, page });

    let request = supabase
      .from("seats")
      .select(SEAT_LIST_SELECT, { count: "exact" })
      .order(filters.sort, { ascending: filters.order === "asc" })
      // Unique tie-breaker so ties on sort columns never repeat/skip rows across pages.
      .order("id", { ascending: true })
      .range(filters.range.from, filters.range.to);

    if (filters.search) {
      request = request.or(filters.search);
    }

    if (filters.airport_id) {
      request = request.eq("airport_id", filters.airport_id);
    }

    if (filters.category_id) {
      request = request.eq("category_id", filters.category_id);
    }

    if (filters.status) {
      request = request.eq("status", filters.status);
    }

    return request;
  }

  const first = await fetchPage(query.page);

  if (!first.error) {
    return {
      seats: (first.data ?? []) as unknown as SeatListItem[],
      total: first.count ?? 0,
      page: query.page,
    };
  }

  if (first.error.code !== RANGE_NOT_SATISFIABLE || query.page === 1) {
    throw first.error;
  }

  // Requested page is past the last row. The 416 response carries no
  // count, so count with a head request, then serve the last valid page.
  const filters = buildSeatsQueryFilters({ ...query, page: 1 });
  let countRequest = supabase
    .from("seats")
    .select("id", { count: "exact", head: true });

  if (filters.search) {
    countRequest = countRequest.or(filters.search);
  }

  if (filters.airport_id) {
    countRequest = countRequest.eq("airport_id", filters.airport_id);
  }

  if (filters.category_id) {
    countRequest = countRequest.eq("category_id", filters.category_id);
  }

  if (filters.status) {
    countRequest = countRequest.eq("status", filters.status);
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

  return {
    seats: (retry.data ?? []) as unknown as SeatListItem[],
    total,
    page: lastPage,
  };
}
