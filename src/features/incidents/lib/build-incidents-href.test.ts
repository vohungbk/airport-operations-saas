import { describe, expect, it } from "vitest";

import { buildIncidentsHref } from "@/features/incidents/lib/build-incidents-href";
import type { IncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";

const BASE: IncidentsQuery = {
  q: undefined,
  status: undefined,
  severity: undefined,
  sort: "created_at",
  order: "desc",
  page: 1,
  page_size: 20,
};

describe("buildIncidentsHref", () => {
  it("should leave out the search when there is none", () => {
    expect(buildIncidentsHref(BASE)).toBe(
      "/incidents?sort=created_at&order=desc&page=1&page_size=20",
    );
  });

  it("should keep the search and let overrides win", () => {
    expect(
      buildIncidentsHref(
        { ...BASE, q: "strap", page: 4 },
        { sort: "severity", order: "asc", page: 1 },
      ),
    ).toBe("/incidents?q=strap&sort=severity&order=asc&page=1&page_size=20");
  });

  it("should write the status and the severity and keep them when sorting or paging", () => {
    const query = { ...BASE, status: "open", severity: "critical" } as const;

    expect(buildIncidentsHref(query, { page: 2 })).toBe(
      "/incidents?status=open&severity=critical&sort=created_at&order=desc&page=2&page_size=20",
    );
    expect(buildIncidentsHref(query, { sort: "status", page: 1 })).toContain(
      "status=open&severity=critical&sort=status",
    );
  });

  it("should drop a filter when it is cleared", () => {
    const href = buildIncidentsHref(
      { ...BASE, status: "open", severity: "high" },
      { status: undefined, page: 1 },
    );

    expect(href).not.toContain("status=");
    expect(href).toContain("severity=high");
  });

  it("should encode a search that has special characters", () => {
    expect(buildIncidentsHref({ ...BASE, q: "a&b=c" })).toContain("q=a%26b%3Dc");
  });
});
