import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { buildPartnerSeatsQueryFilters } from "@/features/seats/lib/build-partner-seats-query-filters";
import type { PartnerSeatsQuery } from "@/features/seats/schemas/partner-seats-query.schema";
import type { Seat } from "@/features/seats/types";
import type { Database } from "@/types/database.types";

/**
 * What a partner user is shown of a seat: the serial number, its status, and
 * the category and airport. Nothing internal: no public token, manufacturer,
 * model, dates, rental cycles or quarantine reason.
 */
export type PartnerSeatListItem = Pick<Seat, "id" | "serial_number" | "status"> & {
  category: { name: string } | null;
  airport: { code: string; name: string } | null;
};

export interface GetPartnerSeatsResult {
  seats: PartnerSeatListItem[];
  total: number;
  /** Page actually returned; differs from the requested page when it was out of range. */
  page: number;
}

export const PARTNER_SEAT_LIST_SELECT =
  "id, serial_number, status, category:seat_categories(name), airport:airports(code, name)";

/** PostgREST error code for a `Range` offset past the last row (HTTP 416). */
const RANGE_NOT_SATISFIABLE = "PGRST103";

/**
 * Server-only. RLS is the scope: a partner user is only given the seats
 * assigned to a booking of their own partner, so there is no `partner_id`
 * filter here. A failed read is thrown, so the error boundary can offer a
 * retry; it is never shown as an empty list.
 */
export async function getPartnerSeats(
  query: PartnerSeatsQuery,
  supabase?: SupabaseClient<Database>,
): Promise<GetPartnerSeatsResult> {
  const client = supabase ?? (await createClient());

  // `select` is a runtime string so the same filter chain serves the page
  // query and the count-only query (results are cast below anyway).
  function filteredRequest(page: number, select: string, head: boolean) {
    const filters = buildPartnerSeatsQueryFilters({ ...query, page });

    let request = client.from("seats").select(select, { count: "exact", head });

    if (filters.serial_pattern) {
      request = request.ilike("serial_number", filters.serial_pattern);
    }

    if (filters.status) {
      request = request.eq("status", filters.status);
    }

    return { request, filters };
  }

  async function fetchPage(page: number) {
    const { request, filters } = filteredRequest(
      page,
      PARTNER_SEAT_LIST_SELECT,
      false,
    );

    return (
      request
        .order(filters.sort, { ascending: filters.order === "asc" })
        // Unique tie-breaker so ties never repeat or skip rows across pages.
        .order("id", { ascending: true })
        .range(filters.range.from, filters.range.to)
    );
  }

  const first = await fetchPage(query.page);

  if (!first.error) {
    return {
      seats: (first.data ?? []) as unknown as PartnerSeatListItem[],
      total: first.count ?? 0,
      page: query.page,
    };
  }

  if (first.error.code !== RANGE_NOT_SATISFIABLE || query.page === 1) {
    throw first.error;
  }

  // Requested page is past the last row. The 416 response carries no count,
  // so count with a head request, then serve the last valid page.
  const { count, error: countError } = await filteredRequest(1, "id", true)
    .request;

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
    seats: (retry.data ?? []) as unknown as PartnerSeatListItem[],
    total,
    page: lastPage,
  };
}
