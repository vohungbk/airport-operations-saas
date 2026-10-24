import { describe, expect, it } from "vitest";

import {
  FORBIDDEN_ERROR,
  INTERNAL_ERROR,
  NOT_FOUND_ERROR,
  mapCommercialTermsError,
} from "@/features/partners/lib/commercial-terms-errors";

describe("mapCommercialTermsError", () => {
  it("should map a refused caller to forbidden", () => {
    expect(mapCommercialTermsError({ code: "42501" })).toBe(FORBIDDEN_ERROR);
  });

  it("should map an unknown partner to not found", () => {
    expect(mapCommercialTermsError({ code: "P0002" })).toBe(NOT_FOUND_ERROR);
  });

  it.each([
    ["TC001", "VALIDATION_ERROR", "partner_share_percent"],
    ["TC002", "VALIDATION_ERROR", "launch_partner_share_percent"],
    ["TC003", "VALIDATION_ERROR", "effective_from"],
    ["TC004", "CONFLICT", "effective_from"],
  ])("should map %s to %s on the field %s", (code, mapped, field) => {
    expect(mapCommercialTermsError({ code })).toMatchObject({ code: mapped, field });
  });

  it("should not show a database error: anything else is a generic error", () => {
    const error = mapCommercialTermsError({ code: "XX000" });

    expect(error).toBe(INTERNAL_ERROR);
    expect(error.message).not.toMatch(/XX000|relation|constraint/);
  });
});
