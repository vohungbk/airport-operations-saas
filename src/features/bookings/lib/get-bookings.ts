import { createClient } from "@/lib/supabase/server";
import { getAirportTimezone } from "@/features/bookings/lib/get-airport-timezone";
import { buildBookingsQueryFilters } from "@/features/bookings/lib/build-bookings-query-filters";
import type { BookingsQuery } from "@/features/bookings/schemas/bookings-query.schema";
import type { Booking } from "@/features/bookings/types";

interface BookingRelations {
  partner: { id: string; name: string; code: string } | null;
  airport: { id: string; code: string; name: string; timezone: string } | null;
  seat: { id: string; serial_number: string } | null;
  category: { id: string; name: string } | null;
  technician: { full_name: string } | null;
}

/**
 * Detail row: the displayed booking columns plus the joined relations.
 * Finance columns are not selected, so partner users never receive them.
 */
export type BookingDetailItem = Omit<
  Booking,
  "paid_days" | "gross_revenue" | "partner_share" | "platform_share"
> &
  BookingRelations;

/** List row: only the columns `bookings-table.tsx` renders. */
export type BookingListItem = Pick<
  Booking,
  "id" | "booking_number" | "pickup_at" | "return_at" | "status" | "created_at"
> &
  Pick<BookingRelations, "partner" | "airport" | "seat" | "category">;

export interface GetBookingsResult {
  bookings: BookingListItem[];
  total: number;
  /** Page actually returned; differs from the requested page when it was out of range. */
  page: number;
}

const BOOKING_RELATIONS_SELECT =
  "partner:partners(id, name, code), airport:airports(id, code, name, timezone), seat:seats(id, serial_number), category:seat_categories(id, name)";

const BOOKING_COLUMNS =
  "id, booking_number, partner_id, airport_id, external_booking_number, pickup_at, return_at, flight_id, scheduled_arrival_at, estimated_arrival_at, actual_arrival_at, seat_category_id, child_age_band, child_height, vehicle, vehicle_bay, assigned_seat_id, assigned_technician_id, daily_rate, status, incident_status, notes, created_at, updated_at";

/** One nested select — never a per-row lookup (no N+1). */
export const BOOKING_WITH_RELATIONS_SELECT = `${BOOKING_COLUMNS}, ${BOOKING_RELATIONS_SELECT}, technician:users!assigned_technician_id(full_name)`;

export const BOOKING_LIST_SELECT = `id, booking_number, pickup_at, return_at, status, created_at, ${BOOKING_RELATIONS_SELECT}`;

/** PostgREST error code for a `Range` offset past the last row (HTTP 416). */
const RANGE_NOT_SATISFIABLE = "PGRST103";

/**
 * Server-only. RLS is the access boundary (a partner_user only ever gets
 * its own partner's rows); filters here are only for the page's search/
 * filter/sort/pagination UI.
 */
export async function getBookings(
  query: BookingsQuery,
): Promise<GetBookingsResult> {
  const supabase = await createClient();

  // Date filters are calendar days at the selected airport; without an
  // airport filter they are interpreted in UTC.
  let timeZone = "UTC";

  if (query.airport_id && (query.date_from || query.date_to)) {
    const airport = await getAirportTimezone(supabase, query.airport_id);

    if (airport.error) {
      throw airport.error;
    }

    timeZone = airport.timezone ?? "UTC";
  }

  // `select` is a runtime string so the same filter chain serves the page
  // query and the count-only query (results are cast below anyway).
  function filteredRequest(page: number, select: string, head: boolean) {
    const filters = buildBookingsQueryFilters({ ...query, page }, timeZone);

    let request = supabase
      .from("bookings")
      .select(select, { count: "exact", head });

    if (filters.search_pattern) {
      request = request.ilike("booking_number", filters.search_pattern);
    }

    if (filters.airport_id) {
      request = request.eq("airport_id", filters.airport_id);
    }

    if (filters.status) {
      request = request.eq("status", filters.status);
    }

    if (filters.pickup_from) {
      request = request.gte("pickup_at", filters.pickup_from);
    }

    if (filters.pickup_before) {
      request = request.lt("pickup_at", filters.pickup_before);
    }

    return { request, filters };
  }

  async function fetchPage(page: number) {
    const { request, filters } = filteredRequest(
      page,
      BOOKING_LIST_SELECT,
      false,
    );

    return (
      request
        .order(filters.sort, { ascending: filters.order === "asc" })
        // Unique tie-breaker so ties on sort columns never repeat/skip rows across pages.
        .order("id", { ascending: true })
        .range(filters.range.from, filters.range.to)
    );
  }

  const first = await fetchPage(query.page);

  if (!first.error) {
    return {
      bookings: (first.data ?? []) as unknown as BookingListItem[],
      total: first.count ?? 0,
      page: query.page,
    };
  }

  if (first.error.code !== RANGE_NOT_SATISFIABLE || query.page === 1) {
    throw first.error;
  }

  // Requested page is past the last row. The 416 response carries no
  // count, so count with a head request, then serve the last valid page.
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
    bookings: (retry.data ?? []) as unknown as BookingListItem[],
    total,
    page: lastPage,
  };
}
