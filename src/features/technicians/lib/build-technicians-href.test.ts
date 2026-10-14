import { describe, expect, it } from "vitest";

import { buildTechniciansHref } from "@/features/technicians/lib/build-technicians-href";
import type { TechniciansQuery } from "@/features/technicians/schemas/technicians-query.schema";

const QUERY: TechniciansQuery = {
  q: "ali",
  sort: "full_name",
  order: "asc",
  page: 2,
  page_size: 20,
};

describe("buildTechniciansHref", () => {
  it("should keep the current search, sort and page size", () => {
    expect(buildTechniciansHref(QUERY)).toBe(
      "/technicians?q=ali&sort=full_name&order=asc&page=2&page_size=20",
    );
  });

  it("should apply overrides over the current query", () => {
    expect(buildTechniciansHref(QUERY, { page: 3 })).toContain("page=3");
  });

  it("should omit q when there is no search", () => {
    expect(buildTechniciansHref({ ...QUERY, q: undefined })).not.toContain("q=");
  });

  it("should encode search text safely", () => {
    expect(buildTechniciansHref({ ...QUERY, q: "a&b=c" })).toContain(
      "q=a%26b%3Dc",
    );
  });
});
