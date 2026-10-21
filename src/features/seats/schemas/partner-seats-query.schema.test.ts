import { describe, expect, it } from "vitest";

import { partnerSeatsQuerySchema } from "@/features/seats/schemas/partner-seats-query.schema";

describe("partnerSeatsQuerySchema", () => {
  it("should fall back to the defaults for an empty address", () => {
    expect(partnerSeatsQuerySchema.parse({})).toEqual({
      q: undefined,
      status: undefined,
      sort: "serial_number",
      order: "asc",
      page: 1,
      page_size: 20,
    });
  });

  it("should keep a valid search, status, sort and page", () => {
    expect(
      partnerSeatsQuerySchema.parse({
        q: " CS-1 ",
        status: "quarantine",
        sort: "status",
        order: "desc",
        page: "3",
        page_size: "50",
      }),
    ).toMatchObject({ q: "CS-1", status: "quarantine", sort: "status", order: "desc", page: 3, page_size: 50 });
  });

  it("should ignore garbled values instead of failing: a bad status, sort, order, page or size", () => {
    expect(
      partnerSeatsQuerySchema.parse({
        status: "bogus",
        sort: "public_token",
        order: "sideways",
        page: "-4",
        page_size: "9999",
      }),
    ).toMatchObject({ status: undefined, sort: "serial_number", order: "asc", page: 1, page_size: 20 });
  });

  it("should drop a partner, airport or category sent in the address, so the scope cannot be chosen", () => {
    const parsed = partnerSeatsQuerySchema.parse({
      partner_id: "b0000000-0000-0000-0000-000000000002",
      airport_id: "a0000000-0000-0000-0000-000000000001",
      category_id: "c0000000-0000-0000-0000-000000000001",
    });

    for (const key of ["partner_id", "airport_id", "category_id"]) {
      expect(parsed).not.toHaveProperty(key);
    }
  });
});
