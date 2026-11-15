import { describe, expect, it } from "vitest";

import { bookingImportsQuerySchema } from "@/features/bookings/schemas/booking-imports-query.schema";

const GUID = "d5000000-0000-4000-8000-000000000001";

describe("bookingImportsQuerySchema (CO-F07-S07)", () => {
  it("should use the last 30 days and page 1 when the address has no filter", () => {
    expect(bookingImportsQuerySchema.parse({})).toEqual({ period: "30d", page: 1 });
  });

  it("should read a valid partner, actor, period and page", () => {
    expect(
      bookingImportsQuerySchema.parse({ partner_id: GUID, actor_id: GUID, period: "all", page: "2" }),
    ).toEqual({ partner_id: GUID, actor_id: GUID, period: "all", page: 2 });
  });

  it("should fall back to the defaults when the values are garbled", () => {
    expect(
      bookingImportsQuerySchema.parse({ partner_id: "x", actor_id: ["a"], period: "forever", page: "-4" }),
    ).toEqual({ period: "30d", page: 1 });
  });
});
