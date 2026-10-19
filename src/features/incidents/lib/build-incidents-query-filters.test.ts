import { describe, expect, it } from "vitest";

import { buildIncidentsQueryFilters } from "@/features/incidents/lib/build-incidents-query-filters";
import type { IncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";

const BASE: IncidentsQuery = {
  q: undefined,
  sort: "created_at",
  order: "desc",
  page: 1,
  page_size: 20,
};

describe("buildIncidentsQueryFilters", () => {
  it("should have no search filter without a search", () => {
    expect(buildIncidentsQueryFilters(BASE).search).toBeUndefined();
  });

  it("should search the type and the description", () => {
    expect(buildIncidentsQueryFilters({ ...BASE, q: "strap" }).search).toBe(
      'type.ilike."%strap%",description.ilike."%strap%"',
    );
  });

  it.each([
    ["50%", '"%50\\\\%%"'],
    ["a_b", '"%a\\\\_b%"'],
    ['say "hi"', '"%say \\"hi\\"%"'],
  ])("should escape %j so it is matched literally", (q, quoted) => {
    expect(buildIncidentsQueryFilters({ ...BASE, q }).search).toBe(
      `type.ilike.${quoted},description.ilike.${quoted}`,
    );
  });

  it.each([["a,b"], ["a(b)"], ["a.b"], ["a:b"]])(
    "should keep %j inside the quotes so it cannot split the filter",
    (q) => {
      const { search } = buildIncidentsQueryFilters({ ...BASE, q });

      expect(search).toBe(
        `type.ilike."%${q}%",description.ilike."%${q}%"`,
      );
    },
  );

  it("should compute the range from the page and the page size", () => {
    expect(
      buildIncidentsQueryFilters({ ...BASE, page: 3, page_size: 10 }).range,
    ).toEqual({ from: 20, to: 29 });
  });
});
