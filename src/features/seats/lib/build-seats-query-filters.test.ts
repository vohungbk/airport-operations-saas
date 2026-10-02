import { describe, expect, it } from "vitest";

import { buildSeatsQueryFilters } from "@/features/seats/lib/build-seats-query-filters";
import type { SeatsQuery } from "@/features/seats/schemas/seats-query.schema";

const BASE_QUERY: SeatsQuery = {
  q: undefined,
  airport_id: undefined,
  category_id: undefined,
  status: undefined,
  sort: "created_at",
  order: "desc",
  page: 1,
  page_size: 20,
};

describe("buildSeatsQueryFilters", () => {
  it("should leave every filter undefined when none is provided", () => {
    const result = buildSeatsQueryFilters(BASE_QUERY);

    expect(result.search).toBeUndefined();
    expect(result.airport_id).toBeUndefined();
    expect(result.category_id).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it("should search serial_number and public_token with a quoted ilike", () => {
    expect(buildSeatsQueryFilters({ ...BASE_QUERY, q: "sn-1" }).search).toBe(
      'serial_number.ilike."%sn-1%",public_token.ilike."%sn-1%"',
    );
  });

  it("should escape ilike wildcards so they match literally", () => {
    expect(buildSeatsQueryFilters({ ...BASE_QUERY, q: "50%_" }).search).toBe(
      'serial_number.ilike."%50\\\\%\\\\_%",public_token.ilike."%50\\\\%\\\\_%"',
    );
  });

  it("should keep commas and parentheses inside the quoted value", () => {
    const { search } = buildSeatsQueryFilters({ ...BASE_QUERY, q: "a,b(c)" });

    expect(search).toBe(
      'serial_number.ilike."%a,b(c)%",public_token.ilike."%a,b(c)%"',
    );
  });

  it("should pass airport, category and status filters through together", () => {
    const result = buildSeatsQueryFilters({
      ...BASE_QUERY,
      airport_id: "a0000000-0000-0000-0000-000000000001",
      category_id: "c0000000-0000-0000-0000-000000000002",
      status: "available",
    });

    expect(result.airport_id).toBe("a0000000-0000-0000-0000-000000000001");
    expect(result.category_id).toBe("c0000000-0000-0000-0000-000000000002");
    expect(result.status).toBe("available");
  });

  it("should compute the zero-based inclusive range from page and page_size", () => {
    expect(
      buildSeatsQueryFilters({ ...BASE_QUERY, page: 3, page_size: 10 }).range,
    ).toEqual({ from: 20, to: 29 });
  });
});
