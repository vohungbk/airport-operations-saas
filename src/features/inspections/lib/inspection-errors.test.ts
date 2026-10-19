import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  isAlreadyRecordedError,
  mapInspectionError,
} from "@/features/inspections/lib/inspection-errors";

const pgError = (code: string) =>
  ({
    code,
    message: "raw relation secret_table failed",
    details: "",
    hint: "",
    name: "PostgrestError",
  }) as PostgrestError;

describe("mapInspectionError", () => {
  it.each([
    ["JB005", "JOB_NOT_ELIGIBLE"],
    ["JB006", "JOB_NOT_ELIGIBLE"],
    ["JB007", "SEAT_NOT_ELIGIBLE"],
    ["23505", "ALREADY_RECORDED"],
    ["42501", "FORBIDDEN"],
    ["P0002", "NOT_FOUND"],
    ["22023", "VALIDATION_ERROR"],
    ["XX000", "INTERNAL_ERROR"],
  ])("should map database error %s to %s", (code, expected) => {
    expect(mapInspectionError(pgError(code)).code).toBe(expected);
  });

  it("should not expose the raw database message", () => {
    expect(mapInspectionError(pgError("XX000")).message).not.toContain(
      "secret_table",
    );
  });
});

describe("isAlreadyRecordedError", () => {
  it("should be true for the duplicate error of the unique index", () => {
    expect(isAlreadyRecordedError(mapInspectionError(pgError("23505")))).toBe(
      true,
    );
  });

  it.each([["JB005"], ["JB007"], ["42501"], ["XX000"]])(
    "should be false for database error %s",
    (code) => {
      expect(isAlreadyRecordedError(mapInspectionError(pgError(code)))).toBe(
        false,
      );
    },
  );

  it("should be false when there is no error", () => {
    expect(isAlreadyRecordedError(undefined)).toBe(false);
  });
});
