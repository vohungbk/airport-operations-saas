import { describe, expect, it } from "vitest";

import { cleaningOutcome, formatCheck, inspectionOutcome } from "@/features/installations/lib/seat-check-text";

describe("seat check text", () => {
  it("should write when a check was made in the zone of the airport, with its outcome", () => {
    expect(formatCheck("2026-10-24T09:20:00Z", "Asia/Dubai", "Pass")).toBe("24 Oct · 13:20 GST · Pass");
  });

  it("should leave the outcome out when it is not known", () => {
    expect(formatCheck("2026-10-24T09:20:00Z", "Asia/Dubai", null)).toBe("24 Oct · 13:20 GST");
  });

  it("should word the outcome of a cleaning and of an inspection", () => {
    expect(cleaningOutcome(true)).toBe("Pass");
    expect(cleaningOutcome(false)).toBe("Fail");
    expect(cleaningOutcome(null)).toBeNull();
    expect(inspectionOutcome("conditional_pass")).toBe("Conditional pass");
    expect(inspectionOutcome("fail")).toBe("Fail");
    expect(inspectionOutcome("other")).toBe("other");
  });
});
