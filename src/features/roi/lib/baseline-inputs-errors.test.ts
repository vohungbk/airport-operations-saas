import { describe, expect, it } from "vitest";

import { INTERNAL_ERROR, mapBaselineInputsError } from "@/features/roi/lib/baseline-inputs-errors";

describe("mapBaselineInputsError (VI-F05-S05)", () => {
  it("should answer forbidden when the caller is not a partner user", () => {
    expect(mapBaselineInputsError({ code: "42501" })).toMatchObject({ code: "FORBIDDEN" });
  });

  it.each([
    ["22023", "Every field is required."],
    ["BL001", "An amount must be zero or more, with at most 2 decimals."],
    ["BL002", "A count must be a whole number of zero or more."],
    ["BL003", "A conversion must be from 0 to 100, with at most 2 decimals."],
  ])("should give the database error %s a clear validation message", (code, message) => {
    expect(mapBaselineInputsError({ code })).toEqual({ code: "VALIDATION_ERROR", message });
  });

  it("should answer a generic error for a code it does not know, and never show the raw error", () => {
    const result = mapBaselineInputsError({ code: "XX000", message: "connection to db.internal:5432 refused" } as never);

    expect(result).toEqual(INTERNAL_ERROR);
    expect(JSON.stringify(result)).not.toContain("db.internal");
  });
});
