import { describe, expect, it } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";

import { mapSeatError } from "@/features/seats/lib/seat-errors";

function pgError(code: string, details = ""): PostgrestError {
  return {
    code,
    message: "raw",
    details,
    hint: "",
    name: "PostgrestError",
  } as PostgrestError;
}

describe("mapSeatError", () => {
  it("should map a serial_number unique violation to DUPLICATE_SERIAL", () => {
    expect(
      mapSeatError(
        pgError("23505", "Key (serial_number)=(SN-1) already exists."),
      ).code,
    ).toBe("DUPLICATE_SERIAL");
  });

  it("should not report a non-serial unique violation as DUPLICATE_SERIAL", () => {
    expect(
      mapSeatError(pgError("23505", "Key (public_token)=(x) already exists."))
        .code,
    ).toBe("INTERNAL_ERROR");
  });

  it.each(["23514", "23503", "22023"])(
    "should map %s to VALIDATION_ERROR",
    (code) => {
      expect(mapSeatError(pgError(code)).code).toBe("VALIDATION_ERROR");
    },
  );

  it("should map a 42501 RLS denial to FORBIDDEN", () => {
    expect(mapSeatError(pgError("42501")).code).toBe("FORBIDDEN");
  });

  it("should map P0002 to NOT_FOUND", () => {
    expect(mapSeatError(pgError("P0002")).code).toBe("NOT_FOUND");
  });

  it("should map 55000 to INVALID_TRANSITION", () => {
    expect(mapSeatError(pgError("55000")).code).toBe("INVALID_TRANSITION");
  });

  it("should map any other error to INTERNAL_ERROR without leaking raw text", () => {
    const result = mapSeatError(pgError("XX000"));

    expect(result.code).toBe("INTERNAL_ERROR");
    expect(result.message).not.toContain("raw");
  });
});
