import { describe, expect, it } from "vitest";

import {
  buildUpdateSeatSchema,
  changeSeatStatusSchema,
  createSeatSchema,
} from "@/features/seats/schemas/seat.schema";

const CATEGORY_ID = "c0000000-0000-0000-0000-000000000002";
const AIRPORT_ID = "a0000000-0000-0000-0000-000000000001";
const SEAT_ID = "e0000000-0000-0000-0000-000000000001";

const VALID_CREATE = {
  serial_number: "SN-0001",
  manufacturer: "Acme",
  model: "Safe 1",
  manufacture_date: "2025-01-31",
  purchase_date: "2025-03-01",
  max_rental_cycles: 200,
  category_id: CATEGORY_ID,
  airport_id: AIRPORT_ID,
};

describe("createSeatSchema", () => {
  it("should parse a valid input", () => {
    expect(createSeatSchema.safeParse(VALID_CREATE).success).toBe(true);
  });

  it("should trim the serial number", () => {
    const result = createSeatSchema.safeParse({
      ...VALID_CREATE,
      serial_number: "  SN-0002  ",
    });

    expect(result.success && result.data.serial_number).toBe("SN-0002");
  });

  it("should reject an empty serial number", () => {
    expect(
      createSeatSchema.safeParse({ ...VALID_CREATE, serial_number: "  " })
        .success,
    ).toBe(false);
  });

  it("should reject a non-positive max_rental_cycles", () => {
    expect(
      createSeatSchema.safeParse({ ...VALID_CREATE, max_rental_cycles: 0 })
        .success,
    ).toBe(false);
  });

  it("should reject a non-integer max_rental_cycles", () => {
    expect(
      createSeatSchema.safeParse({ ...VALID_CREATE, max_rental_cycles: 1.5 })
        .success,
    ).toBe(false);
  });

  it("should reject an impossible calendar date", () => {
    expect(
      createSeatSchema.safeParse({
        ...VALID_CREATE,
        manufacture_date: "2025-02-31",
      }).success,
    ).toBe(false);
  });

  it("should reject a non-uuid category_id", () => {
    expect(
      createSeatSchema.safeParse({ ...VALID_CREATE, category_id: "nope" })
        .success,
    ).toBe(false);
  });

  it("should strip public_token, status and rental_cycles supplied by the client", () => {
    const result = createSeatSchema.safeParse({
      ...VALID_CREATE,
      public_token: "attacker-token",
      status: "retired",
      rental_cycles: 99,
    });

    expect(result.success).toBe(true);
    expect(result.success && Object.keys(result.data)).not.toEqual(
      expect.arrayContaining(["public_token"]),
    );
    expect(result.success && "status" in result.data).toBe(false);
    expect(result.success && "rental_cycles" in result.data).toBe(false);
  });
});

describe("buildUpdateSeatSchema", () => {
  const VALID_UPDATE: Record<string, unknown> = { ...VALID_CREATE };
  delete VALID_UPDATE.serial_number;

  it("should parse a valid input", () => {
    expect(buildUpdateSeatSchema().safeParse(VALID_UPDATE).success).toBe(true);
  });

  it("should strip serial_number so it can never change", () => {
    const result = buildUpdateSeatSchema().safeParse({
      ...VALID_UPDATE,
      serial_number: "SN-HACK",
    });

    expect(result.success && "serial_number" in result.data).toBe(false);
  });

  it("should reject max_rental_cycles below the current rental_cycles", () => {
    const schema = buildUpdateSeatSchema(50);

    expect(
      schema.safeParse({ ...VALID_UPDATE, max_rental_cycles: 49 }).success,
    ).toBe(false);
  });

  it("should accept max_rental_cycles equal to the current rental_cycles", () => {
    const schema = buildUpdateSeatSchema(50);

    expect(
      schema.safeParse({ ...VALID_UPDATE, max_rental_cycles: 50 }).success,
    ).toBe(true);
  });
});

describe("changeSeatStatusSchema", () => {
  it("should require a reason to quarantine", () => {
    const result = changeSeatStatusSchema.safeParse({
      seat_id: SEAT_ID,
      to_status: "quarantine",
      reason: "  ",
    });

    expect(result.success).toBe(false);
  });

  it("should accept quarantine with a reason", () => {
    expect(
      changeSeatStatusSchema.safeParse({
        seat_id: SEAT_ID,
        to_status: "quarantine",
        reason: "Cracked shell",
      }).success,
    ).toBe(true);
  });

  it("should convert a missing reason to null for non-quarantine targets", () => {
    const result = changeSeatStatusSchema.safeParse({
      seat_id: SEAT_ID,
      to_status: "available",
    });

    expect(result.success && result.data.reason).toBeNull();
  });

  it("should reject an operational status as a manual target", () => {
    expect(
      changeSeatStatusSchema.safeParse({
        seat_id: SEAT_ID,
        to_status: "in_use",
      }).success,
    ).toBe(false);
  });
});
