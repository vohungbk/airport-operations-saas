import { describe, expect, it } from "vitest";

import { getPartnerAccessIssue } from "@/lib/auth/partner-scope";
import { ROLES } from "@/lib/auth/roles";
import { PARTNER_STATUSES } from "@/features/partners/types";

describe("getPartnerAccessIssue", () => {
  it("should be no_partner for a partner user with no partner", () => {
    expect(
      getPartnerAccessIssue({ role: "partner_user", partner_id: null, partner_status: null }),
    ).toBe("no_partner");
  });

  it("should let a partner user of an active partner through", () => {
    expect(
      getPartnerAccessIssue({ role: "partner_user", partner_id: "p-1", partner_status: "active" }),
    ).toBeNull();
  });

  it.each(PARTNER_STATUSES.filter((status) => status !== "active"))(
    "should be partner_inactive when the partner is %s",
    (status) => {
      expect(
        getPartnerAccessIssue({ role: "partner_user", partner_id: "p-1", partner_status: status }),
      ).toBe("partner_inactive");
    },
  );

  it("should be partner_inactive, not open, when the partner could not be read", () => {
    expect(
      getPartnerAccessIssue({ role: "partner_user", partner_id: "p-1", partner_status: null }),
    ).toBe("partner_inactive");
  });

  it.each(ROLES.filter((role) => role !== "partner_user"))(
    "should never touch the %s role, which has no partner by design",
    (role) => {
      expect(getPartnerAccessIssue({ role, partner_id: null, partner_status: null })).toBeNull();
      expect(
        getPartnerAccessIssue({ role, partner_id: "p-1", partner_status: "inactive" }),
      ).toBeNull();
    },
  );
});
