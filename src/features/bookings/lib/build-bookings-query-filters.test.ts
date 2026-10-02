import { describe, expect, it } from "vitest";

import { buildBookingsQueryFilters } from "@/features/bookings/lib/build-bookings-query-filters";
import type { BookingsQuery } from "@/features/bookings/schemas/bookings-query.schema";

const BASE_QUERY: BookingsQuery = {
  q: undefined,
  airport_id: undefined,
  status: undefined,
  date_from: undefined,
  date_to: undefined,
  sort: "created_at",
  order: "desc",
  page: 1,
  page_size: 20,
};

describe("buildBookingsQueryFilters", () => {
  it("should leave every filter undefined when none is provided", () => {
    const result = buildBookingsQueryFilters(BASE_QUERY, "UTC");

    expect(result.search_pattern).toBeUndefined();
    expect(result.status).toBeUndefined();
    expect(result.pickup_from).toBeUndefined();
    expect(result.pickup_before).toBeUndefined();
  });

  it("should wrap the search term in ilike wildcards", () => {
    expect(
      buildBookingsQueryFilters({ ...BASE_QUERY, q: "bk-1" }, "UTC")
        .search_pattern,
    ).toBe("%bk-1%");
  });

  it("should escape ilike wildcards so they match literally", () => {
    expect(
      buildBookingsQueryFilters({ ...BASE_QUERY, q: "50%_" }, "UTC")
        .search_pattern,
    ).toBe("%50\\%\\_%");
  });

  it("should interpret the date range as whole days in the given timezone", () => {
    const result = buildBookingsQueryFilters(
      { ...BASE_QUERY, date_from: "2026-09-05", date_to: "2026-09-05" },
      "Asia/Dubai",
    );

    expect(result.pickup_from).toBe("2026-09-04T20:00:00.000Z");
    expect(result.pickup_before).toBe("2026-09-05T20:00:00.000Z");
  });

  it("should compute the zero-based row range from page and page size", () => {
    expect(
      buildBookingsQueryFilters({ ...BASE_QUERY, page: 3, page_size: 10 }, "UTC")
        .range,
    ).toEqual({ from: 20, to: 29 });
  });
});
