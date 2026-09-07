import { describe, expect, it } from "vitest";

import { isValidIanaTimezone } from "@/features/airports/lib/is-valid-timezone";

describe("isValidIanaTimezone", () => {
  it("should return true for a valid IANA timezone", () => {
    expect(isValidIanaTimezone("Asia/Dubai")).toBe(true);
  });

  it("should return true for another valid IANA timezone", () => {
    expect(isValidIanaTimezone("America/New_York")).toBe(true);
  });

  it("should return false for an invalid timezone string", () => {
    expect(isValidIanaTimezone("Not/AZone")).toBe(false);
  });

  it("should return false for an empty string", () => {
    expect(isValidIanaTimezone("")).toBe(false);
  });

  it("should return false for a lowercase variant of a valid timezone", () => {
    expect(isValidIanaTimezone("asia/dubai")).toBe(false);
  });
});
