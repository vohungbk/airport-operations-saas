import { describe, expect, it } from "vitest";

import { getSeatScanView } from "@/features/seats/lib/seat-scan-access";

describe("getSeatScanView", () => {
  it.each([["admin"], ["operations_manager"]] as const)(
    "should send %s to the full seat page",
    (role) => {
      expect(getSeatScanView(role).openFullDetail).toBe(true);
    },
  );

  it("should keep a technician on the read-only card, with the reason and the cleaning link", () => {
    expect(getSeatScanView("technician")).toEqual({
      openFullDetail: false,
      showQuarantineReason: true,
      showCleaningLink: true,
      backHref: "/jobs",
      backLabel: "Back to jobs",
    });
  });

  it("should give a partner the card without the reason or the cleaning link", () => {
    expect(getSeatScanView("partner_user")).toEqual({
      openFullDetail: false,
      showQuarantineReason: false,
      showCleaningLink: false,
      backHref: "/partner/seats",
      backLabel: "Back to seats",
    });
  });
});
