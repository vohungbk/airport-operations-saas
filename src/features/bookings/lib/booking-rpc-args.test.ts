import { describe, expect, it } from "vitest";

import {
  resolveRpcArgs,
  toCreateBookingRpcArgs,
  toCreatePartnerBookingRpcArgs,
  toUpdateBookingRpcArgs,
  toUpdatePartnerBookingRpcArgs,
} from "@/features/bookings/lib/booking-rpc-args";

const CREATE_INPUT = {
  partner_id: "b0000000-0000-0000-0000-000000000001",
  airport_id: "a0000000-0000-0000-0000-000000000001",
  seat_category_id: "c0000000-0000-0000-0000-000000000001",
  daily_rate: "75.50",
  pickup_at: "2026-09-01T08:00",
  return_at: "2026-09-04T08:00",
  assigned_seat_id: "",
  external_booking_number: "",
  child_age_band: "",
  child_height: "",
  vehicle: "",
  vehicle_bay: "",
  notes: "",
};

describe("toCreateBookingRpcArgs", () => {
  it("should convert times to UTC using the airport timezone and the rate to a number", () => {
    const args = toCreateBookingRpcArgs(CREATE_INPUT, "Asia/Dubai");

    expect(args?.p_pickup_at).toBe("2026-09-01T04:00:00.000Z");
    expect(args?.p_return_at).toBe("2026-09-04T04:00:00.000Z");
    expect(args?.p_daily_rate).toBe(75.5);
  });

  it("should turn blank optional fields into undefined so the RPC default applies", () => {
    const args = toCreateBookingRpcArgs(CREATE_INPUT, "Asia/Dubai");

    expect(args?.p_assigned_seat_id).toBeUndefined();
    expect(args?.p_child_height).toBeUndefined();
    expect(args?.p_notes).toBeUndefined();
  });

  it("should return null when the timezone is unknown", () => {
    expect(toCreateBookingRpcArgs(CREATE_INPUT, "Not/AZone")).toBeNull();
  });
});

describe("toUpdateBookingRpcArgs", () => {
  it("should carry the booking id and expected_updated_at through unchanged", () => {
    const args = toUpdateBookingRpcArgs(
      "f0000000-0000-0000-0000-000000000001",
      {
        expected_updated_at: "2026-09-01T04:00:00.123456+00:00",
        pickup_at: "2026-09-01T08:00",
        return_at: "2026-09-02T08:00",
        child_height: "95.5",
      },
      "Asia/Dubai",
    );

    expect(args?.p_expected_updated_at).toBe("2026-09-01T04:00:00.123456+00:00");
    expect(args?.p_child_height).toBe(95.5);
  });
});

describe("resolveRpcArgs", () => {
  it("should return the built args for a known timezone", () => {
    expect(resolveRpcArgs("Asia/Dubai", (tz) => ({ tz }))).toEqual({
      args: { tz: "Asia/Dubai" },
    });
  });

  it("should return NOT_FOUND when the airport timezone is missing", () => {
    expect(resolveRpcArgs(null, () => ({}))).toEqual({
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });

  it("should return a validation error when the args cannot be built", () => {
    expect(resolveRpcArgs("Asia/Dubai", () => null)).toEqual({
      error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
    });
  });
});

describe("partner booking RPC args (VI-F03-S03)", () => {
  const CREATE = {
    airport_id: "a0000000-0000-0000-0000-000000000001",
    seat_category_id: "c0000000-0000-0000-0000-000000000001",
    daily_rate: "75.50",
    pickup_at: "2026-09-01T08:00",
    return_at: "2026-09-04T08:00",
    external_booking_number: "",
    child_age_band: "",
    child_height: "",
    vehicle: "",
    vehicle_bay: "",
    notes: "",
  };

  it("should build create args with UTC times, a numeric rate, and no partner or seat", () => {
    const args = toCreatePartnerBookingRpcArgs(CREATE, "Asia/Dubai");

    expect(args?.p_pickup_at).toBe("2026-09-01T04:00:00.000Z");
    expect(args?.p_daily_rate).toBe(75.5);
    expect(args).not.toHaveProperty("p_partner_id");
    expect(args).not.toHaveProperty("p_assigned_seat_id");
  });

  it("should build update args with the lost-update guard and no seat", () => {
    const { airport_id, seat_category_id, daily_rate, ...detail } = CREATE;
    void airport_id;
    void seat_category_id;
    void daily_rate;
    const args = toUpdatePartnerBookingRpcArgs(
      "f0000000-0000-4000-8000-000000000001",
      { ...detail, expected_updated_at: "2026-09-01T00:00:00.000Z" },
      "Asia/Dubai",
    );

    expect(args?.p_expected_updated_at).toBe("2026-09-01T00:00:00.000Z");
    expect(args?.p_return_at).toBe("2026-09-04T04:00:00.000Z");
    expect(args).not.toHaveProperty("p_assigned_seat_id");
    expect(args).not.toHaveProperty("p_daily_rate");
  });

  it("should return null for a time that cannot be converted", () => {
    expect(
      toCreatePartnerBookingRpcArgs({ ...CREATE, pickup_at: "2026-09-01T08:00" }, "Not/AZone"),
    ).toBeNull();
  });
});
