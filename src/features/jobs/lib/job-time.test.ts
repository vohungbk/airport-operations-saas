import { describe, expect, it } from "vitest";

import { formatDate, formatDateRangeLabel, formatNextJob, formatTime, nextDay, zonedDayStart, zoneLabel } from "@/features/jobs/lib/job-time";

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

  it("should start a day at local midnight in the zone of the airport", () => {
    expect(zonedDayStart("2026-11-04", "Asia/Dubai")).toBe("2026-11-03T20:00:00.000Z");
    expect(zonedDayStart("2026-11-04", "UTC")).toBe("2026-11-04T00:00:00.000Z");
  });

  it("should give the next day, across a month end", () => {
    expect(nextDay("2026-11-04")).toBe("2026-11-05");
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
  });

  it("should write a date range as the design does", () => {
    expect(formatDateRangeLabel("2026-11-01", "2026-11-04", "Asia/Dubai")).toBe("01-04 Nov 2026 GST");
    expect(formatDateRangeLabel("2026-10-28", "2026-11-04", "Asia/Dubai")).toBe("28 Oct 2026 - 04 Nov 2026 GST");
    expect(formatDateRangeLabel("2026-11-01", undefined, "Asia/Dubai")).toBe("From 01 Nov 2026 GST");
    expect(formatDateRangeLabel(undefined, "2026-11-04", "Asia/Dubai")).toBe("Until 04 Nov 2026 GST");
    expect(formatDateRangeLabel(undefined, undefined, "Asia/Dubai")).toBe("");
  });
});
