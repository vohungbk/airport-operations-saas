import { describe, expect, it } from "vitest";

import {
  FORBIDDEN_ERROR,
  INTERNAL_ERROR,
  NOT_ADJUSTABLE_ERROR,
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  mapAdjustmentError,
} from "@/features/bookings/lib/adjustment-errors";

describe("mapAdjustmentError", () => {
  it("should map a refused caller to forbidden", () => {
    expect(mapAdjustmentError({ code: "42501" })).toBe(FORBIDDEN_ERROR);
  });

  it("should map an unknown booking to not found", () => {
    expect(mapAdjustmentError({ code: "P0002" })).toBe(NOT_FOUND_ERROR);
  });

  it("should map a booking with no revenue to a conflict", () => {
    expect(mapAdjustmentError({ code: "BA004" })).toBe(NOT_ADJUSTABLE_ERROR);
  });

  it.each([
    ["BA002", "amount"],
    ["BA003", "amount"],
    ["BA005", "reason"],
    ["22P02", "type"],
  ])("should map %s to a validation error under the field %s", (code, field) => {
    expect(mapAdjustmentError({ code })).toMatchObject({ code: "VALIDATION_ERROR", field });
  });

  it("should map a missing value to the general validation error", () => {
    expect(mapAdjustmentError({ code: "22023" })).toBe(VALIDATION_ERROR);
  });

  it("should not show a database error: anything else is a generic error", () => {
    const error = mapAdjustmentError({ code: "XX000" });

    expect(error).toBe(INTERNAL_ERROR);
    expect(error.message).not.toMatch(/XX000|relation|constraint|BA00/);
  });
});
