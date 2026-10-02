import { describe, expect, it } from "vitest";

import { bookingsQuerySchema } from "@/features/bookings/schemas/bookings-query.schema";

describe("bookingsQuerySchema", () => {
  it("should apply defaults for an empty query", () => {
    expect(bookingsQuerySchema.parse({})).toMatchObject({
      sort: "created_at",
      order: "desc",
      page: 1,
      page_size: 20,
    });
  });

  it("should fall back instead of throwing on garbled values", () => {
    const result = bookingsQuerySchema.parse({
      status: "bogus",
      airport_id: "nope",
      sort: "password",
      order: "sideways",
      page: "-4",
      page_size: "9999",
      date_from: "2026-13-45",
    });

    expect(result.status).toBeUndefined();
    expect(result.airport_id).toBeUndefined();
    expect(result.sort).toBe("created_at");
    expect(result.order).toBe("desc");
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
    expect(result.date_from).toBeUndefined();
  });

  it("should keep valid filters", () => {
    const result = bookingsQuerySchema.parse({
      q: " BK-0001 ",
      status: "confirmed",
      date_from: "2026-09-01",
      date_to: "2026-09-30",
      sort: "pickup_at",
      order: "asc",
      page: "2",
    });

    expect(result).toMatchObject({
      q: "BK-0001",
      status: "confirmed",
      date_from: "2026-09-01",
      date_to: "2026-09-30",
      sort: "pickup_at",
      order: "asc",
      page: 2,
    });
  });
});
