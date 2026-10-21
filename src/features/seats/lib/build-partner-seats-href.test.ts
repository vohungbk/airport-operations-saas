import { describe, expect, it } from "vitest";

import { buildPartnerSeatsHref } from "@/features/seats/lib/build-partner-seats-href";
import { partnerSeatsQuerySchema } from "@/features/seats/schemas/partner-seats-query.schema";

const query = (raw: Record<string, string> = {}) => partnerSeatsQuerySchema.parse(raw);

describe("buildPartnerSeatsHref", () => {
  it("should point at the partner seats view, never the admin seats list", () => {
    expect(buildPartnerSeatsHref(query())).toMatch(/^\/partner\/seats\?/);
  });

  it("should keep the search and the status, and leave out the page unless it is asked for", () => {
    const href = buildPartnerSeatsHref(query({ q: "cs", status: "available" }));

    expect(href).toContain("q=cs");
    expect(href).toContain("status=available");
    expect(href).not.toContain("page=");
  });

  it("should include the page when it is overridden, and start a new sort at page 1", () => {
    expect(buildPartnerSeatsHref(query(), { page: 2 })).toContain("page=2");
    expect(buildPartnerSeatsHref(query({ page: "4" }), { sort: "status", order: "desc" })).not.toContain(
      "page=",
    );
  });
});
