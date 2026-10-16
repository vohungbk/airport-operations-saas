import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { mapInstallationError } from "@/features/installations/lib/installation-errors";

const pgError = (code: string) =>
  ({
    code,
    message: "raw relation secret_table failed",
    details: "",
    hint: "",
    name: "PostgrestError",
  }) as PostgrestError;

describe("mapInstallationError", () => {
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
    expect(mapInstallationError(pgError(code)).code).toBe(expected);
  });

  it("should not expose the raw database message", () => {
    expect(mapInstallationError(pgError("XX000")).message).not.toContain(
      "secret_table",
    );
  });
});
