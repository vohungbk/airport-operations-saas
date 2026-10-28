import { describe, expect, it } from "vitest";

import { getSeatScanHref } from "@/features/installations/lib/seat-scan-href";

const job = (overrides: Record<string, unknown> = {}) => ({
  id: "j-1",
  job_type: "installation" as const,
  status: "assigned" as const,
  technician: { id: "t-1" },
  ...overrides,
});
const technician = { id: "t-1", role: "technician" as const };

describe("getSeatScanHref", () => {
  it("should offer the scan on an active installation job assigned to the technician", () => {
    expect(getSeatScanHref(job(), technician)).toBe("/jobs/j-1/scan");
  });

  it("should not offer it on a job that is assigned to someone else", () => {
    expect(getSeatScanHref(job({ technician: { id: "t-2" } }), technician)).toBeNull();
  });

  it("should not offer it on a job that is done or is not an installation", () => {
    expect(getSeatScanHref(job({ status: "completed" }), technician)).toBeNull();
    expect(getSeatScanHref(job({ job_type: "cleaning" }), technician)).toBeNull();
  });
});
