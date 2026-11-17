import { describe, expect, it } from "vitest";

import { buildPartnersQueryFilters } from "@/features/partners/lib/build-partners-query-filters";
import type { PartnersQuery } from "@/features/partners/schemas/partners-query.schema";

const BASE_QUERY: PartnersQuery = {
  q: undefined,
  status: undefined,
  sort: "created_at",
  order: "desc",
  page: 1,
  page_size: 8,
};

describe("buildPartnersQueryFilters", () => {
  it("should leave search undefined when q is not provided", () => {
    const result = buildPartnersQueryFilters(BASE_QUERY);

    expect(result.search).toBeUndefined();
  });

  it("should build a name/code/contact ilike or-filter from q", () => {
    const result = buildPartnersQueryFilters({ ...BASE_QUERY, q: "emirates" });

    expect(result.search).toBe("name.ilike.%emirates%,code.ilike.%emirates%,contact_email.ilike.%emirates%");
  });

  it("should escape commas in q so they cannot be misread as an or-filter separator", () => {
    const result = buildPartnersQueryFilters({ ...BASE_QUERY, q: "a,b" });

    expect(result.search).toBe("name.ilike.%a\\,b%,code.ilike.%a\\,b%,contact_email.ilike.%a\\,b%");
  });

  it("should escape parentheses in q so they cannot be misread as or-filter grouping", () => {
    const result = buildPartnersQueryFilters({ ...BASE_QUERY, q: "a(b)c" });

    expect(result.search).toBe(
      "name.ilike.%a\\(b\\)c%,code.ilike.%a\\(b\\)c%,contact_email.ilike.%a\\(b\\)c%",
    );
  });

  it("should carry status/sort/order through unchanged", () => {
    const result = buildPartnersQueryFilters({
      ...BASE_QUERY,
      status: "active",
      sort: "name",
      order: "asc",
    });

    expect(result.status).toBe("active");
    expect(result.sort).toBe("name");
    expect(result.order).toBe("asc");
  });

  it("should compute range from page/page_size (page 1, size 8 -> 0..7)", () => {
    const result = buildPartnersQueryFilters(BASE_QUERY);

    expect(result.range).toEqual({ from: 0, to: 7 });
  });

  it("should compute range for a later page (page 3, size 16 -> 32..47)", () => {
    const result = buildPartnersQueryFilters({
      ...BASE_QUERY,
      page: 3,
      page_size: 16,
    });

    expect(result.range).toEqual({ from: 32, to: 47 });
  });
});
