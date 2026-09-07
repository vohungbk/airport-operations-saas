import { describe, expect, it } from "vitest";

import { STATUS_VARIANT } from "@/features/partners/components/partner-status-badge";
import { PARTNER_STATUSES } from "@/features/partners/types";

describe("PartnerStatusBadge STATUS_VARIANT", () => {
  it("should map 'active' to the success variant", () => {
    expect(STATUS_VARIANT.active).toBe("success");
  });

  it("should map 'pending' to the warning variant", () => {
    expect(STATUS_VARIANT.pending).toBe("warning");
  });

  it("should map 'suspended' to the warning variant", () => {
    expect(STATUS_VARIANT.suspended).toBe("warning");
  });

  it("should map 'inactive' to a neutral (muted) variant, not destructive", () => {
    expect(STATUS_VARIANT.inactive).toBe("muted");
  });

  it("should have a variant defined for every PartnerStatus", () => {
    for (const status of PARTNER_STATUSES) {
      expect(STATUS_VARIANT[status]).toBeDefined();
    }
  });
});
