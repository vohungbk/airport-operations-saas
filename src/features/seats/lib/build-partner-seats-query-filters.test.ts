import { describe, expect, it } from "vitest";

import { buildPartnerSeatsQueryFilters } from "@/features/seats/lib/build-partner-seats-query-filters";
import { partnerSeatsQuerySchema } from "@/features/seats/schemas/partner-seats-query.schema";

const query = (raw: Record<string, string> = {}) => partnerSeatsQuerySchema.parse(raw);

describe("buildPartnerSeatsQueryFilters", () => {
  it("should have no search pattern and the first page range by default", () => {
    expect(buildPartnerSeatsQueryFilters(query())).toEqual({
      serial_pattern: undefined,
      status: undefined,
      sort: "serial_number",
      order: "asc",
      range: { from: 0, to: 19 },
    });
  });

  it("should compute the range of a later page", () => {
    expect(buildPartnerSeatsQueryFilters(query({ page: "3", page_size: "10" })).range).toEqual({
      from: 20,
      to: 29,
    });
  });

  it("should match the search literally: % and _ are escaped", () => {
    expect(buildPartnerSeatsQueryFilters(query({ q: "50%_a" })).serial_pattern).toBe(
      "%50\\%\\_a%",
    );
  });

  it("should search the serial number only: the pattern is not a filter on the public token", () => {
    const filters = buildPartnerSeatsQueryFilters(query({ q: "abc" }));

    expect(JSON.stringify(filters)).not.toContain("public_token");
  });

  it("should pass the status filter through", () => {
    expect(buildPartnerSeatsQueryFilters(query({ status: "cleaning" })).status).toBe("cleaning");
  });
});
