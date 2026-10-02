import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { mapBookingError } from "@/features/bookings/lib/booking-errors";

const err = (code: string) =>
  ({
    code,
    message: "raw database message naming BK-00099",
    details: "",
    hint: "",
    name: "PostgrestError",
  }) as PostgrestError;

describe("mapBookingError", () => {
  it.each([
    ["23514", "VALIDATION_ERROR"],
    ["23503", "VALIDATION_ERROR"],
    ["22023", "VALIDATION_ERROR"],
    ["42501", "FORBIDDEN"],
    ["P0002", "NOT_FOUND"],
    ["55000", "INVALID_TRANSITION"],
    ["BK001", "SEAT_UNAVAILABLE"],
    ["BK002", "SEAT_CONFLICT"],
    ["BK003", "SEAT_CATEGORY_MISMATCH"],
    ["BK004", "STALE_DATA"],
    ["BK005", "SEAT_NOT_FOUND"],
  ])("should map %s to %s", (code, expected) => {
    expect(mapBookingError(err(code)).code).toBe(expected);
  });

  it("should map an unknown code to INTERNAL_ERROR", () => {
    expect(mapBookingError(err("XX000")).code).toBe("INTERNAL_ERROR");
  });

  it("should never leak the raw database message", () => {
    expect(mapBookingError(err("BK002")).message).not.toContain("BK-00099");
  });
});
