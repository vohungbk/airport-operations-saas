import { describe, expect, it } from "vitest";

import {
  createAirportSchema,
  updateAirportSchema,
} from "@/features/airports/schemas/airport.schema";

const VALID_CREATE_INPUT = {
  code: "DXB",
  name: "Dubai International Airport",
  city: "Dubai",
  country: "United Arab Emirates",
  timezone: "Asia/Dubai",
};

describe("createAirportSchema", () => {
  it("should parse a valid input", () => {
    const result = createAirportSchema.safeParse(VALID_CREATE_INPUT);

    expect(result.success).toBe(true);
  });

  it("should uppercase a lowercase code", () => {
    const result = createAirportSchema.safeParse({
      ...VALID_CREATE_INPUT,
      code: "dxb",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("DXB");
    }
  });

  it("should trim whitespace from code before validating its format", () => {
    const result = createAirportSchema.safeParse({
      ...VALID_CREATE_INPUT,
      code: "  dxb  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("DXB");
    }
  });

  it("should reject a missing code", () => {
    const withoutCode: Record<string, unknown> = { ...VALID_CREATE_INPUT };
    delete withoutCode.code;
    const result = createAirportSchema.safeParse(withoutCode);

    expect(result.success).toBe(false);
  });

  it("should reject a code shorter than 2 characters", () => {
    const result = createAirportSchema.safeParse({
      ...VALID_CREATE_INPUT,
      code: "D",
    });

    expect(result.success).toBe(false);
  });

  it("should reject a code longer than 10 characters", () => {
    const result = createAirportSchema.safeParse({
      ...VALID_CREATE_INPUT,
      code: "ABCDEFGHIJK",
    });

    expect(result.success).toBe(false);
  });

  it("should reject a code containing non-alphanumeric characters", () => {
    const result = createAirportSchema.safeParse({
      ...VALID_CREATE_INPUT,
      code: "DX-B",
    });

    expect(result.success).toBe(false);
  });

  it("should reject a missing name", () => {
    const withoutName: Record<string, unknown> = { ...VALID_CREATE_INPUT };
    delete withoutName.name;
    const result = createAirportSchema.safeParse(withoutName);

    expect(result.success).toBe(false);
  });

  it("should reject a missing city", () => {
    const withoutCity: Record<string, unknown> = { ...VALID_CREATE_INPUT };
    delete withoutCity.city;
    const result = createAirportSchema.safeParse(withoutCity);

    expect(result.success).toBe(false);
  });

  it("should reject a missing country", () => {
    const withoutCountry: Record<string, unknown> = { ...VALID_CREATE_INPUT };
    delete withoutCountry.country;
    const result = createAirportSchema.safeParse(withoutCountry);

    expect(result.success).toBe(false);
  });

  it("should reject a missing timezone", () => {
    const withoutTimezone: Record<string, unknown> = {
      ...VALID_CREATE_INPUT,
    };
    delete withoutTimezone.timezone;
    const result = createAirportSchema.safeParse(withoutTimezone);

    expect(result.success).toBe(false);
  });

  it("should reject an invalid IANA timezone", () => {
    const result = createAirportSchema.safeParse({
      ...VALID_CREATE_INPUT,
      timezone: "Not/AZone",
    });

    expect(result.success).toBe(false);
  });

  it("should trim whitespace from name, city, and country", () => {
    const result = createAirportSchema.safeParse({
      ...VALID_CREATE_INPUT,
      name: "  Dubai International Airport  ",
      city: "  Dubai  ",
      country: "  United Arab Emirates  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Dubai International Airport");
      expect(result.data.city).toBe("Dubai");
      expect(result.data.country).toBe("United Arab Emirates");
    }
  });
});

describe("updateAirportSchema", () => {
  const VALID_UPDATE_INPUT = {
    name: "Dubai International Airport",
    city: "Dubai",
    country: "United Arab Emirates",
    timezone: "Asia/Dubai",
  };

  it("should parse a valid input", () => {
    const result = updateAirportSchema.safeParse(VALID_UPDATE_INPUT);

    expect(result.success).toBe(true);
  });

  it("should not have a code field, even when one is provided in the raw input", () => {
    const result = updateAirportSchema.safeParse({
      ...VALID_UPDATE_INPUT,
      code: "SHOULD-BE-IGNORED",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("code");
    }
  });

  it("should reject a missing name", () => {
    const withoutName: Record<string, unknown> = { ...VALID_UPDATE_INPUT };
    delete withoutName.name;
    const result = updateAirportSchema.safeParse(withoutName);

    expect(result.success).toBe(false);
  });

  it("should reject a missing city", () => {
    const withoutCity: Record<string, unknown> = { ...VALID_UPDATE_INPUT };
    delete withoutCity.city;
    const result = updateAirportSchema.safeParse(withoutCity);

    expect(result.success).toBe(false);
  });

  it("should reject a missing country", () => {
    const withoutCountry: Record<string, unknown> = { ...VALID_UPDATE_INPUT };
    delete withoutCountry.country;
    const result = updateAirportSchema.safeParse(withoutCountry);

    expect(result.success).toBe(false);
  });

  it("should reject a missing timezone", () => {
    const withoutTimezone: Record<string, unknown> = {
      ...VALID_UPDATE_INPUT,
    };
    delete withoutTimezone.timezone;
    const result = updateAirportSchema.safeParse(withoutTimezone);

    expect(result.success).toBe(false);
  });

  it("should reject an invalid IANA timezone", () => {
    const result = updateAirportSchema.safeParse({
      ...VALID_UPDATE_INPUT,
      timezone: "Not/AZone",
    });

    expect(result.success).toBe(false);
  });
});
