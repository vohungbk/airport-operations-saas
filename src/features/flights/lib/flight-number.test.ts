import { describe, expect, it } from "vitest";

import { FLIGHT_NUMBER_PATTERN, flightNumberField, normalizeFlightNumber } from "./flight-number";

describe("normalizeFlightNumber", () => {
  it("should drop spaces and upper-case the letters", () => {
    expect(normalizeFlightNumber(" vn 123 ")).toBe("VN123");
  });

  it("should give the same text when it is applied twice", () => {
    expect(normalizeFlightNumber(normalizeFlightNumber("ek 203"))).toBe("EK203");
  });

  it("should give an empty text for blank input", () => {
    expect(normalizeFlightNumber("   ")).toBe("");
  });
});

describe("flightNumberField", () => {
  it("should accept an empty value, which means no flight", () => {
    expect(flightNumberField.safeParse("").success).toBe(true);
    expect(flightNumberField.safeParse(undefined).success).toBe(true);
  });

  it.each(["VN123", "ek203", "A1", "ABCD1234"])("should accept %s", (value) => {
    expect(flightNumberField.safeParse(value).success).toBe(true);
  });

  it.each(["V", "ABCDEFGHI", "VN-123", "VN_123", "VN/1"])("should reject %s", (value) => {
    expect(flightNumberField.safeParse(value).success).toBe(false);
  });

  it("should use the same pattern as the database check", () => {
    expect(FLIGHT_NUMBER_PATTERN.source).toBe("^[A-Z0-9]{2,8}$");
  });
});
