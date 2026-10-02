import { describe, expect, it } from "vitest";

import { buildSeatsHref } from "@/features/seats/lib/build-seats-href";
import type { SeatsQuery } from "@/features/seats/schemas/seats-query.schema";

const QUERY: SeatsQuery = {
  q: "sn",
  airport_id: "a0000000-0000-0000-0000-000000000001",
  category_id: undefined,
  status: "available",
  sort: "created_at",
  order: "desc",
  page: 2,
  page_size: 20,
};

describe("buildSeatsHref", () => {
  it("should keep active filters and set the requested page", () => {
    expect(buildSeatsHref(QUERY, { page: 3 })).toBe(
      "/seats?q=sn&airport_id=a0000000-0000-0000-0000-000000000001&status=available&sort=created_at&order=desc&page=3&page_size=20",
    );
  });

  it("should omit page when only the sort changes so it restarts at page 1", () => {
    expect(buildSeatsHref(QUERY, { sort: "serial_number", order: "asc" })).not.toContain(
      "page=",
    );
  });
});
