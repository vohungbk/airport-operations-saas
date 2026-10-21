import { describe, expect, it } from "vitest";

import { isUnlinkedPartnerUser } from "@/lib/auth/partner-scope";
import { ROLES } from "@/lib/auth/roles";

describe("isUnlinkedPartnerUser", () => {
  it("should be true only for a partner user with no partner", () => {
    expect(isUnlinkedPartnerUser({ role: "partner_user", partner_id: null })).toBe(true);
    expect(isUnlinkedPartnerUser({ role: "partner_user", partner_id: "p-1" })).toBe(false);
  });

  it.each(ROLES.filter((role) => role !== "partner_user"))(
    "should be false for the %s role, which has no partner by design",
    (role) => {
      expect(isUnlinkedPartnerUser({ role, partner_id: null })).toBe(false);
    },
  );
});
