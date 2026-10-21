import { describe, expect, it } from "vitest";

import { PARTNER_HOME_ITEMS } from "@/features/partners/lib/partner-home-items";

describe("PARTNER_HOME_ITEMS", () => {
  it("should lead to the bookings list and to the partner seats view", () => {
    expect(PARTNER_HOME_ITEMS.map((item) => [item.id, item.href])).toEqual([
      ["bookings", "/bookings"],
      ["seats", "/partner/seats"],
    ]);
  });

  it("should not link a view to the admin seats area, which a partner user cannot open", () => {
    for (const item of PARTNER_HOME_ITEMS) {
      expect(item.href).not.toMatch(/^\/seats/);
    }
  });
});
