import { describe, expect, it } from "vitest";

import {
  isIncidentUnavailableError,
  mapIncidentError,
} from "@/features/incidents/lib/incident-errors";

const db = (code: string) => ({ code, message: "raw", details: "", hint: "" }) as never;

describe("mapIncidentError", () => {
  it("should talk about the incident, not about a job", () => {
    expect(mapIncidentError(db("P0002")).message).toContain("incident");
    expect(mapIncidentError(db("P0002")).message).not.toContain("job");
    expect(mapIncidentError(db("JB004")).message).toContain("incident");
  });

  it("should not expose the raw database message", () => {
    for (const code of ["42501", "P0002", "55000", "JB004", "22023", "XX000"]) {
      expect(mapIncidentError(db(code)).message).not.toContain("raw");
    }
  });
});

describe("isIncidentUnavailableError", () => {
  it.each([["NOT_FOUND"], ["FORBIDDEN"]] as const)("should be true for %s", (code) => {
    expect(isIncidentUnavailableError({ code, message: "" })).toBe(true);
  });

  it.each([["STALE_DATA"], ["INVALID_TRANSITION"], ["NETWORK_ERROR"]] as const)(
    "should be false for %s, which a retry can fix",
    (code) => {
      expect(isIncidentUnavailableError({ code, message: "" })).toBe(false);
    },
  );

  it("should be false when there is no error", () => {
    expect(isIncidentUnavailableError(undefined)).toBe(false);
  });
});
