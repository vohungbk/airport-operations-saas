import { escapeIlikeValue } from "@/features/seat-categories/lib/escape-ilike";
import { zonedDayStartToUtcIso } from "@/features/bookings/lib/booking-time";
import type { BookingStatus } from "@/features/bookings/types";
import type {
  BookingsQuery,
  BookingsSortColumn,
} from "@/features/bookings/schemas/bookings-query.schema";

export interface BookingsQueryFilters {
  /** `ilike` pattern for `booking_number`, or `undefined` without a search. */
  search_pattern: string | undefined;
  airport_id: string | undefined;
  status: BookingStatus | undefined;
  /** Inclusive lower bound on `pickup_at` (UTC ISO). */
  pickup_from: string | undefined;
  /** Exclusive upper bound on `pickup_at` (UTC ISO). */
  pickup_before: string | undefined;
  sort: BookingsSortColumn;
  order: "asc" | "desc";
  range: { from: number; to: number };
}

/**
 * `date_from`/`date_to` are calendar days interpreted in `timeZone` (the
 * selected airport's timezone, UTC when no airport is selected).
 */
export function buildBookingsQueryFilters(
  query: BookingsQuery,
  timeZone: string,
): BookingsQueryFilters {
  const { q, airport_id, status, date_from, date_to, sort, order, page, page_size } =
    query;

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  return {
    search_pattern: q ? `%${escapeIlikeValue(q)}%` : undefined,
    airport_id,
    status,
    pickup_from: date_from
      ? (zonedDayStartToUtcIso(date_from, timeZone) ?? undefined)
      : undefined,
    pickup_before: date_to
      ? (zonedDayStartToUtcIso(date_to, timeZone, 1) ?? undefined)
      : undefined,
    sort,
    order,
    range: { from, to },
  };
}
