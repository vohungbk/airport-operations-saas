import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  isJobUnavailableError,
  mapJobError,
} from "@/features/jobs/lib/job-errors";

const pgError = (code: string) =>
  ({
    code,
    message: "raw database message",
    details: "",
    hint: "",
    name: "PostgrestError",
  }) as PostgrestError;

describe("mapJobError", () => {
  it("should tell the user the job is no longer assigned to them when it is not found", () => {
    const error = mapJobError(pgError("P0002"));

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe(
      "This job was not found or is no longer assigned to you.",
    );
  });

  it("should not reveal whether the job exists in the message", () => {
    expect(mapJobError(pgError("P0002")).message).not.toMatch(/exist/i);
  });

  it("should not expose the raw database message", () => {
    expect(mapJobError(pgError("XX000")).message).not.toContain("raw");
  });
});

describe("isJobUnavailableError", () => {
  it("should be true when the job is not found or forbidden", () => {
    expect(isJobUnavailableError(mapJobError(pgError("P0002")))).toBe(true);
    expect(isJobUnavailableError(mapJobError(pgError("42501")))).toBe(true);
  });

  it("should be false for errors a retry can fix", () => {
    for (const code of ["JB004", "55000", "22023", "XX000"]) {
      expect(isJobUnavailableError(mapJobError(pgError(code)))).toBe(false);
    }
  });

  it("should be false when there is no error", () => {
    expect(isJobUnavailableError(undefined)).toBe(false);
  });
});
