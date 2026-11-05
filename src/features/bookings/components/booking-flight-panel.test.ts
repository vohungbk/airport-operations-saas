import { describe, expect, it } from "vitest";

import { getUnlinkedMessage } from "@/features/bookings/components/booking-flight-panel";

describe("getUnlinkedMessage", () => {
  it("should show the empty state when the booking has no flight number", () => {
    expect(getUnlinkedMessage(null, null)).toBe("No flight is linked to this booking.");
    expect(getUnlinkedMessage(undefined, undefined)).toBe("No flight is linked to this booking.");
    expect(getUnlinkedMessage("", null)).toBe("No flight is linked to this booking.");
  });

  it("should say the flight was not found and that the arrival can be entered by hand", () => {
    expect(getUnlinkedMessage("NOPE1", "not_found")).toBe(
      "Flight NOPE1 was not found. Operations can enter the arrival by hand.",
    );
  });

  it("should say the flight is not linked yet when the lookup did not run", () => {
    expect(getUnlinkedMessage("VN123", null)).toBe("Flight VN123 is not linked yet.");
  });
});
