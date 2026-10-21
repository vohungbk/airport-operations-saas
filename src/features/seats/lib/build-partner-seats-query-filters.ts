import { escapeIlikeValue } from "@/features/seat-categories/lib/escape-ilike";
import type { SeatStatus } from "@/features/seats/types";
import type {
  PartnerSeatsQuery,
  PartnerSeatsSortColumn,
} from "@/features/seats/schemas/partner-seats-query.schema";

export interface PartnerSeatsQueryFilters {
  /** `ilike` pattern on the serial number only, or `undefined` without a search. */
  serial_pattern: string | undefined;
  status: SeatStatus | undefined;
  sort: PartnerSeatsSortColumn;
  order: "asc" | "desc";
  range: { from: number; to: number };
}

/**
 * Pure. The search matches the serial number only (never the public token),
 * with `%` and `_` matched literally.
 */
export function buildPartnerSeatsQueryFilters(
  query: PartnerSeatsQuery,
): PartnerSeatsQueryFilters {
  const { q, status, sort, order, page, page_size } = query;
  const from = (page - 1) * page_size;

  return {
    serial_pattern: q ? `%${escapeIlikeValue(q)}%` : undefined,
    status,
    sort,
    order,
    range: { from, to: from + page_size - 1 },
  };
}
