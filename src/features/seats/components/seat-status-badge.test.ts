import { describe, expect, it } from "vitest";

import { STATUS_VARIANT } from "@/features/seats/components/seat-status-badge";
import { SEAT_STATUSES } from "@/features/seats/lib/seat-status";

describe("SeatStatusBadge STATUS_VARIANT", () => {
  it("should map available to success", () => {
    expect(STATUS_VARIANT.available).toBe("success");
  });

  it("should map reserved and in_use to info", () => {
    expect(STATUS_VARIANT.reserved).toBe("info");
    expect(STATUS_VARIANT.in_use).toBe("info");
  });

  it("should map cleaning and inspection to warning", () => {
    expect(STATUS_VARIANT.cleaning).toBe("warning");
    expect(STATUS_VARIANT.inspection).toBe("warning");
  });

  it("should map quarantine to destructive and retired to muted", () => {
    expect(STATUS_VARIANT.quarantine).toBe("destructive");
    expect(STATUS_VARIANT.retired).toBe("muted");
  });

  it("should define a variant for every seat status", () => {
    for (const status of SEAT_STATUSES) {
      expect(STATUS_VARIANT[status]).toBeDefined();
    }
  });
});
