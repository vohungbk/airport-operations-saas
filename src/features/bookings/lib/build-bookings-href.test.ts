import { describe, expect, it } from "vitest";

import { buildBookingsHref } from "@/features/bookings/lib/build-bookings-href";
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

describe("buildBookingsHref", () => {
  it("should keep every active filter in the href", () => {
    const href = buildBookingsHref({
      ...BASE_QUERY,
      q: "BK-0001",
      status: "pending",
      date_from: "2026-09-01",
      date_to: "2026-09-30",
    });
    const params = new URL(href, "http://x").searchParams;

    expect(params.get("q")).toBe("BK-0001");
    expect(params.get("status")).toBe("pending");
    expect(params.get("date_from")).toBe("2026-09-01");
    expect(params.get("date_to")).toBe("2026-09-30");
  });

  it("should omit page unless a page override is given", () => {
    expect(buildBookingsHref(BASE_QUERY)).not.toContain("page=");
    expect(buildBookingsHref(BASE_QUERY, { page: 3 })).toContain("page=3");
  });

  it("should apply sort and order overrides", () => {
    const href = buildBookingsHref(BASE_QUERY, {
      sort: "pickup_at",
      order: "asc",
    });

    expect(href).toContain("sort=pickup_at");
    expect(href).toContain("order=asc");
  });
});
