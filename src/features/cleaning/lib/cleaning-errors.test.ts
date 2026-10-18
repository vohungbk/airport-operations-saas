import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  isAlreadyRecordedError,
  mapCleaningError,
} from "@/features/cleaning/lib/cleaning-errors";

const pgError = (code: string) =>
  ({
    code,
    message: "raw relation secret_table failed",
    details: "",
    hint: "",
    name: "PostgrestError",
  }) as PostgrestError;

describe("mapCleaningError", () => {
  it.each([
    ["JB005", "JOB_NOT_ELIGIBLE"],
    ["JB006", "JOB_NOT_ELIGIBLE"],
    ["JB007", "SEAT_NOT_ELIGIBLE"],
    ["JB008", "SEAT_NOT_ELIGIBLE"],
    ["JB009", "SEAT_IN_USE"],
    ["JB010", "NOT_STARTED"],
    ["JB011", "ALREADY_RECORDED"],
    ["JB012", "SEAT_NOT_ELIGIBLE"],
    ["23505", "ALREADY_RECORDED"],
    ["42501", "FORBIDDEN"],
    ["P0002", "NOT_FOUND"],
    ["22023", "VALIDATION_ERROR"],
    ["XX000", "INTERNAL_ERROR"],
  ])("should map database error %s to %s", (code, expected) => {
    expect(mapCleaningError(pgError(code)).code).toBe(expected);
  });

  it("should tell the user to handle the other booking when one is using the seat", () => {
    expect(mapCleaningError(pgError("JB009")).message).toContain(
      "Handle that booking first",
    );
  });

  it("should not expose the raw database message", () => {
    expect(mapCleaningError(pgError("XX000")).message).not.toContain(
      "secret_table",
    );
  });
});

describe("isAlreadyRecordedError", () => {
  it.each([["23505"], ["JB011"]])(
    "should be true for database error %s (someone else got there first)",
    (code) => {
      expect(isAlreadyRecordedError(mapCleaningError(pgError(code)))).toBe(true);
    },
  );

  it.each([["JB005"], ["JB008"], ["JB009"], ["42501"], ["XX000"]])(
    "should be false for database error %s",
    (code) => {
      expect(isAlreadyRecordedError(mapCleaningError(pgError(code)))).toBe(
        false,
      );
    },
  );

  it("should be false when there is no error", () => {
    expect(isAlreadyRecordedError(undefined)).toBe(false);
  });
});
