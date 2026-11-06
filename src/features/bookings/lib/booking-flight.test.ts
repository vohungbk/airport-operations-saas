import { describe, expect, it } from "vitest";

import { formatBookingFlight } from "@/features/bookings/lib/booking-flight";

const flight = (over: Record<string, unknown> = {}) => ({
  flight_number: "EK 203",
  scheduled_arrival_at: "2026-09-01T04:00:00.000Z",
  estimated_arrival_at: null,
  actual_arrival_at: null,
  delay_minutes: null,
  ...over,
});

describe("formatBookingFlight", () => {
  it("should write a dash when the booking has no flight", () => {
    expect(formatBookingFlight(null)).toBe("-");
  });

  it("should write the minutes early with a minus sign", () => {
    expect(formatBookingFlight(flight({ estimated_arrival_at: "2026-09-01T03:15:00.000Z" }))).toBe("EK 203 · −45m");
  });

  it("should write the minutes late with a plus sign", () => {
    expect(formatBookingFlight(flight({ estimated_arrival_at: "2026-09-01T04:50:00.000Z" }))).toBe("EK 203 · +50m");
  });

  it("should say on time when the estimate equals the schedule", () => {
    expect(formatBookingFlight(flight({ estimated_arrival_at: "2026-09-01T04:00:00.000Z" }))).toBe("EK 203 · on time");
  });

  it("should give the number alone when the offset cannot be told", () => {
    expect(formatBookingFlight(flight())).toBe("EK 203");
  });

  it("should use the stored delay when there is no estimate", () => {
    expect(formatBookingFlight(flight({ delay_minutes: 20 }))).toBe("EK 203 · +20m");
  });
});

describe("formatBookingFlight cancelled or diverted (VI-F02-S06)", () => {
  const base = {
    flight_number: "EK 203",
    scheduled_arrival_at: "2026-10-24T11:00:00Z",
    estimated_arrival_at: "2026-10-24T10:15:00Z",
    actual_arrival_at: null,
    delay_minutes: null,
  };

  it("should say cancelled or diverted instead of an offset", () => {
    expect(formatBookingFlight({ ...base, status: "cancelled" })).toBe("EK 203 · cancelled");
    expect(formatBookingFlight({ ...base, status: "diverted" })).toBe("EK 203 · diverted");
  });

  it("should keep the offset for a scheduled flight", () => {
    expect(formatBookingFlight({ ...base, status: "scheduled" })).toBe("EK 203 · −45m");
  });
});
