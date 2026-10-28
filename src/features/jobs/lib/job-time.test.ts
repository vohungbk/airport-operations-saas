import { describe, expect, it } from "vitest";

import { formatDate, formatNextJob, formatTime, zoneLabel } from "@/features/jobs/lib/job-time";

describe("job time", () => {
  it("should write the time and the date in the zone of the airport", () => {
    expect(formatTime("2026-10-24T12:30:00Z", "Asia/Dubai")).toBe("16:30");
    expect(formatDate("2026-10-24T22:30:00Z", "Asia/Dubai")).toBe("25 Oct 2026");
  });

  it("should name the zone of Dubai GST, as the design does", () => {
    expect(zoneLabel("Asia/Dubai")).toBe("GST");
  });

  it("should name another zone with its short name", () => {
    expect(zoneLabel("UTC")).toBe("UTC");
  });

  it("should write the time of the next job in UTC", () => {
    expect(formatNextJob("2026-10-28T14:30:00Z")).toBe("28 Oct, 14:30 UTC");
  });
});
