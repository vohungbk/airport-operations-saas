import { describe, expect, it } from "vitest";

import { seatsQuerySchema } from "@/features/seats/schemas/seats-query.schema";

describe("seatsQuerySchema", () => {
  it("should apply defaults for an empty query", () => {
    expect(seatsQuerySchema.parse({})).toEqual({
      q: undefined,
      airport_id: undefined,
      category_id: undefined,
      status: undefined,
      sort: "created_at",
      order: "desc",
      page: 1,
      page_size: 20,
    });
  });

  it("should fall back to the default sort for a column outside the allowlist", () => {
    expect(seatsQuerySchema.parse({ sort: "rental_cycles; drop" }).sort).toBe(
      "created_at",
    );
  });

  it("should drop an unknown status instead of failing", () => {
    expect(seatsQuerySchema.parse({ status: "broken" }).status).toBeUndefined();
  });

  it("should drop a malformed airport_id", () => {
    expect(seatsQuerySchema.parse({ airport_id: "x" }).airport_id).toBeUndefined();
  });

  it("should accept combined valid filters", () => {
    const result = seatsQuerySchema.parse({
      airport_id: "a0000000-0000-0000-0000-000000000001",
      category_id: "c0000000-0000-0000-0000-000000000002",
      status: "quarantine",
    });

    expect(result.status).toBe("quarantine");
    expect(result.airport_id).toBe("a0000000-0000-0000-0000-000000000001");
  });

  it("should reset an out-of-bounds page and page_size to defaults", () => {
    const result = seatsQuerySchema.parse({ page: "0", page_size: "1000" });

    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
  });

  it("should trim q and treat blank q as absent", () => {
    expect(seatsQuerySchema.parse({ q: "   " }).q).toBeUndefined();
    expect(seatsQuerySchema.parse({ q: " SN-1 " }).q).toBe("SN-1");
  });
});
