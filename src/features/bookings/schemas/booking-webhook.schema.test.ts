import { describe, expect, it } from "vitest";

import { bookingWebhookBodySchema } from "@/features/bookings/schemas/booking-webhook.schema";

const VALID = {
  external_booking_number: "EXT-1",
  seat_category_id: "c0000000-0000-0000-0000-000000000001",
  pickup_at: "2030-01-01T10:00:00Z",
  return_at: "2030-01-04T10:00:00+07:00",
  daily_rate: 90.5,
};

describe("bookingWebhookBodySchema (CO-F07-S08)", () => {
  it("should accept a body with the required fields and the optional ones", () => {
    expect(bookingWebhookBodySchema.safeParse({ ...VALID, vehicle: "Van", notes: "Two seats" }).success).toBe(true);
  });

  it.each([
    ["external_booking_number", { external_booking_number: "  " }],
    ["seat_category_id", { seat_category_id: "nope" }],
    ["pickup_at", { pickup_at: "2030-01-01 10:00" }],
    ["return_at", { return_at: "2029-12-31T10:00:00Z" }],
    ["daily_rate", { daily_rate: 0 }],
    ["daily_rate", { daily_rate: 90.123 }],
    ["daily_rate", { daily_rate: "90" }],
  ])("should reject a body whose %s is invalid", (field, change) => {
    const result = bookingWebhookBodySchema.safeParse({ ...VALID, ...change });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it("should reject a body that misses a required field", () => {
    const rest: Partial<typeof VALID> = { ...VALID };
    delete rest.seat_category_id;

    expect(bookingWebhookBodySchema.safeParse(rest).success).toBe(false);
  });
});
