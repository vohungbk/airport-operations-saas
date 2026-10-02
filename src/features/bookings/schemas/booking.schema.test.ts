import { describe, expect, it } from "vitest";

import {
  changeBookingStatusSchema,
  createBookingSchema,
  updateBookingSchema,
} from "@/features/bookings/schemas/booking.schema";

const VALID_CREATE = {
  partner_id: "b0000000-0000-0000-0000-000000000001",
  airport_id: "a0000000-0000-0000-0000-000000000001",
  seat_category_id: "c0000000-0000-0000-0000-000000000001",
  daily_rate: "75",
  pickup_at: "2026-09-01T08:00",
  return_at: "2026-09-04T08:00",
};

describe("createBookingSchema", () => {
  it("should accept a minimal valid booking without a seat", () => {
    expect(createBookingSchema.safeParse(VALID_CREATE).success).toBe(true);
  });

  it("should accept a seeded non-RFC uuid for the seat", () => {
    const result = createBookingSchema.safeParse({
      ...VALID_CREATE,
      assigned_seat_id: "e0000000-0000-0000-0000-000000000001",
    });

    expect(result.success).toBe(true);
  });

  it("should reject a return time before the pickup time", () => {
    const result = createBookingSchema.safeParse({
      ...VALID_CREATE,
      return_at: "2026-08-31T08:00",
    });

    expect(result.success).toBe(false);
  });

  it("should accept a return time equal to the pickup time", () => {
    const result = createBookingSchema.safeParse({
      ...VALID_CREATE,
      return_at: VALID_CREATE.pickup_at,
    });

    expect(result.success).toBe(true);
  });

  it("should reject a negative or non-numeric daily rate", () => {
    expect(
      createBookingSchema.safeParse({ ...VALID_CREATE, daily_rate: "-5" })
        .success,
    ).toBe(false);
    expect(
      createBookingSchema.safeParse({ ...VALID_CREATE, daily_rate: "abc" })
        .success,
    ).toBe(false);
    expect(
      createBookingSchema.safeParse({ ...VALID_CREATE, daily_rate: "" }).success,
    ).toBe(false);
  });

  it("should reject a malformed pickup time", () => {
    expect(
      createBookingSchema.safeParse({
        ...VALID_CREATE,
        pickup_at: "2026-02-31T08:00",
      }).success,
    ).toBe(false);
  });

  it("should strip status and booking_number if a client sends them", () => {
    const result = createBookingSchema.safeParse({
      ...VALID_CREATE,
      status: "confirmed",
      booking_number: "BK-99999",
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("status");
    expect(result.data).not.toHaveProperty("booking_number");
  });

  it("should reject an invalid seat id", () => {
    expect(
      createBookingSchema.safeParse({
        ...VALID_CREATE,
        assigned_seat_id: "nope",
      }).success,
    ).toBe(false);
  });
});

describe("updateBookingSchema", () => {
  const VALID_UPDATE = {
    expected_updated_at: "2026-09-01T04:00:00.123456+00:00",
    pickup_at: "2026-09-01T08:00",
    return_at: "2026-09-02T08:00",
  };

  it("should accept a valid update", () => {
    expect(updateBookingSchema.safeParse(VALID_UPDATE).success).toBe(true);
  });

  it("should require expected_updated_at", () => {
    const { expected_updated_at: _ignored, ...rest } = VALID_UPDATE;
    void _ignored;

    expect(updateBookingSchema.safeParse(rest).success).toBe(false);
  });

  it("should strip read-only fields so they can never be changed", () => {
    const result = updateBookingSchema.safeParse({
      ...VALID_UPDATE,
      status: "completed",
      partner_id: "b0000000-0000-0000-0000-000000000002",
      daily_rate: "1",
      booking_number: "BK-99999",
      seat_category_id: "c0000000-0000-0000-0000-000000000002",
    });

    expect(result.success).toBe(true);
    for (const key of [
      "status",
      "partner_id",
      "daily_rate",
      "booking_number",
      "seat_category_id",
    ]) {
      expect(result.data).not.toHaveProperty(key);
    }
  });
});

describe("changeBookingStatusSchema", () => {
  const BOOKING_ID = "f0000000-0000-0000-0000-000000000001";

  it("should accept confirming without a reason", () => {
    const result = changeBookingStatusSchema.safeParse({
      booking_id: BOOKING_ID,
      to_status: "confirmed",
    });

    expect(result.success).toBe(true);
  });

  it("should require a reason when cancelling", () => {
    const result = changeBookingStatusSchema.safeParse({
      booking_id: BOOKING_ID,
      to_status: "cancelled",
      reason: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("should require a reason for no_show and trim it", () => {
    const result = changeBookingStatusSchema.safeParse({
      booking_id: BOOKING_ID,
      to_status: "no_show",
      reason: "  Did not arrive  ",
    });

    expect(result.data?.reason).toBe("Did not arrive");
  });

  it("should reject workflow-owned targets", () => {
    for (const to_status of ["assigned", "in_progress", "completed", "pending"]) {
      expect(
        changeBookingStatusSchema.safeParse({
          booking_id: BOOKING_ID,
          to_status,
          reason: "x",
        }).success,
      ).toBe(false);
    }
  });
});
