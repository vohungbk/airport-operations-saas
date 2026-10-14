import { describe, expect, it } from "vitest";

import { buildTechniciansQueryFilters } from "@/features/technicians/lib/build-technicians-query-filters";
import type { TechniciansQuery } from "@/features/technicians/schemas/technicians-query.schema";

const BASE_QUERY: TechniciansQuery = {
  q: undefined,
  sort: "full_name",
  order: "asc",
  page: 1,
  page_size: 20,
};

describe("buildTechniciansQueryFilters", () => {
  it("should leave search undefined when q is not provided", () => {
    expect(buildTechniciansQueryFilters(BASE_QUERY).search).toBeUndefined();
  });

  it("should build a quoted full_name/email ilike or-filter from q", () => {
    const result = buildTechniciansQueryFilters({ ...BASE_QUERY, q: "ali" });

    expect(result.search).toBe(
      'full_name.ilike."%ali%",email.ilike."%ali%"',
    );
  });

  it("should keep commas and parentheses inside the quoted value", () => {
    const result = buildTechniciansQueryFilters({ ...BASE_QUERY, q: "a,(b)" });

    expect(result.search).toBe(
      'full_name.ilike."%a,(b)%",email.ilike."%a,(b)%"',
    );
  });

  it("should match ilike wildcards literally", () => {
    const result = buildTechniciansQueryFilters({ ...BASE_QUERY, q: "50%_" });

    expect(result.search).toContain('"%50\\\\%\\\\_%"');
  });

  it("should compute the range from page and page size", () => {
    const result = buildTechniciansQueryFilters({
      ...BASE_QUERY,
      page: 3,
      page_size: 10,
    });

    expect(result.range).toEqual({ from: 20, to: 29 });
  });
});
