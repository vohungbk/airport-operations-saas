import { describe, expect, it } from "vitest";

import { STATUS_VARIANT } from "@/features/bookings/components/booking-status-badge";
import { BOOKING_STATUSES } from "@/features/bookings/lib/booking-status";

describe("BookingStatusBadge STATUS_VARIANT", () => {
  it("should map pending to warning and completed to success", () => {
    expect(STATUS_VARIANT.pending).toBe("warning");
    expect(STATUS_VARIANT.completed).toBe("success");
  });

  it("should map cancelled to muted and no_show to destructive", () => {
    expect(STATUS_VARIANT.cancelled).toBe("muted");
    expect(STATUS_VARIANT.no_show).toBe("destructive");
  });

  it("should define a variant for every booking status", () => {
    for (const status of BOOKING_STATUSES) {
      expect(STATUS_VARIANT[status]).toBeDefined();
    }
  });
});
