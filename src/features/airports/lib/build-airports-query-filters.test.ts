import { describe, expect, it } from "vitest";

import { buildAirportsQueryFilters } from "@/features/airports/lib/build-airports-query-filters";
import type { AirportsQuery } from "@/features/airports/schemas/airports-query.schema";

const BASE_QUERY: AirportsQuery = {
  q: undefined,
  sort: "code",
  order: "asc",
  page: 1,
  page_size: 20,
};

describe("buildAirportsQueryFilters", () => {
  it("should leave search undefined when q is not provided", () => {
    const result = buildAirportsQueryFilters(BASE_QUERY);

    expect(result.search).toBeUndefined();
  });

  it("should build a code/name/city ilike or-filter from q", () => {
    const result = buildAirportsQueryFilters({ ...BASE_QUERY, q: "dubai" });

    expect(result.search).toBe(
      "code.ilike.%dubai%,name.ilike.%dubai%,city.ilike.%dubai%",
    );
  });

  it("should escape commas in q so they cannot be misread as an or-filter separator", () => {
    const result = buildAirportsQueryFilters({ ...BASE_QUERY, q: "a,b" });

    expect(result.search).toBe(
      "code.ilike.%a\\,b%,name.ilike.%a\\,b%,city.ilike.%a\\,b%",
    );
  });

  it("should escape parentheses in q so they cannot be misread as or-filter grouping", () => {
    const result = buildAirportsQueryFilters({ ...BASE_QUERY, q: "a(b)c" });

    expect(result.search).toBe(
      "code.ilike.%a\\(b\\)c%,name.ilike.%a\\(b\\)c%,city.ilike.%a\\(b\\)c%",
    );
  });

  it("should carry sort/order through unchanged", () => {
    const result = buildAirportsQueryFilters({
      ...BASE_QUERY,
      sort: "name",
      order: "desc",
    });

    expect(result.sort).toBe("name");
    expect(result.order).toBe("desc");
  });

  it("should compute range from page/page_size (page 1, size 20 -> 0..19)", () => {
    const result = buildAirportsQueryFilters(BASE_QUERY);

    expect(result.range).toEqual({ from: 0, to: 19 });
  });

  it("should compute range for a later page (page 3, size 10 -> 20..29)", () => {
    const result = buildAirportsQueryFilters({
      ...BASE_QUERY,
      page: 3,
      page_size: 10,
    });

    expect(result.range).toEqual({ from: 20, to: 29 });
  });
});
