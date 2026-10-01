import { describe, expect, it } from "vitest";

import { buildSeatCategoriesQueryFilters } from "@/features/seat-categories/lib/build-seat-categories-query-filters";
import type { SeatCategoriesQuery } from "@/features/seat-categories/schemas/seat-categories-query.schema";

const BASE_QUERY: SeatCategoriesQuery = {
  q: undefined,
  status: undefined,
  sort: "name",
  order: "asc",
  page: 1,
  page_size: 20,
};

describe("buildSeatCategoriesQueryFilters", () => {
  it("should leave search and is_active undefined when not provided", () => {
    const result = buildSeatCategoriesQueryFilters(BASE_QUERY);

    expect(result.search).toBeUndefined();
    expect(result.is_active).toBeUndefined();
  });

  it("should build a quoted name/safety_standard ilike or-filter from q", () => {
    const result = buildSeatCategoriesQueryFilters({
      ...BASE_QUERY,
      q: "booster",
    });

    expect(result.search).toBe(
      'name.ilike."%booster%",safety_standard.ilike."%booster%"',
    );
  });

  it("should keep commas and parentheses inside the quoted value", () => {
    const result = buildSeatCategoriesQueryFilters({
      ...BASE_QUERY,
      q: "a,b(c)",
    });

    expect(result.search).toBe(
      'name.ilike."%a,b(c)%",safety_standard.ilike."%a,b(c)%"',
    );
  });

  it("should escape ilike wildcards so % and _ match literally", () => {
    const result = buildSeatCategoriesQueryFilters({
      ...BASE_QUERY,
      q: "50%_x",
    });

    expect(result.search).toBe(
      'name.ilike."%50\\\\%\\\\_x%",safety_standard.ilike."%50\\\\%\\\\_x%"',
    );
  });

  it("should escape double quotes in q", () => {
    const result = buildSeatCategoriesQueryFilters({ ...BASE_QUERY, q: 'a"b' });

    expect(result.search).toBe(
      'name.ilike."%a\\"b%",safety_standard.ilike."%a\\"b%"',
    );
  });

  it("should map status active/inactive to is_active true/false", () => {
    expect(
      buildSeatCategoriesQueryFilters({ ...BASE_QUERY, status: "active" })
        .is_active,
    ).toBe(true);
    expect(
      buildSeatCategoriesQueryFilters({ ...BASE_QUERY, status: "inactive" })
        .is_active,
    ).toBe(false);
  });

  it("should compute the pagination range from page and page_size", () => {
    const result = buildSeatCategoriesQueryFilters({
      ...BASE_QUERY,
      page: 3,
      page_size: 10,
    });

    expect(result.range).toEqual({ from: 20, to: 29 });
  });

  it("should pass sort and order through", () => {
    const result = buildSeatCategoriesQueryFilters({
      ...BASE_QUERY,
      sort: "created_at",
      order: "desc",
    });

    expect(result.sort).toBe("created_at");
    expect(result.order).toBe("desc");
  });
});
