import { describe, expect, it } from "vitest";

import { buildJobsHref } from "@/features/jobs/lib/build-jobs-href";
import type { JobsQuery } from "@/features/jobs/schemas/jobs-query.schema";

const QUERY: JobsQuery = {
  q: "BK-1",
  status: "assigned",
  technician_id: "d0000000-0000-0000-0000-000000000001",
  sort: "assigned_at",
  order: "desc",
  page: 2,
  page_size: 20,
};

describe("buildJobsHref", () => {
  it("should keep every active filter", () => {
    const href = buildJobsHref(QUERY);

    expect(href).toContain("q=BK-1");
    expect(href).toContain("status=assigned");
    expect(href).toContain("technician_id=d0000000-0000-0000-0000-000000000001");
    expect(href).toContain("page=2");
  });

  it("should apply overrides and drop a cleared filter", () => {
    const href = buildJobsHref(QUERY, { status: undefined, page: 1 });

    expect(href).not.toContain("status=");
    expect(href).toContain("page=1");
  });

  it("should encode search text safely", () => {
    expect(buildJobsHref({ ...QUERY, q: "a&b=c" })).toContain("q=a%26b%3Dc");
  });
});
