import { describe, expect, it } from "vitest";

import {
  formatClock,
  getBannerDetail,
  getSyncNote,
  formatFlightDateTime,
  getInstallationDeadline,
  isDeadlineMoved,
  isFlightLanded,
  shouldShowStatusBadge,
} from "@/features/flights/lib/flight-panel";

const job = (over: Partial<{ deadline_at: string | null; status: string; job_type: string }> = {}) => ({
  deadline_at: "2026-10-24T11:15:00.000Z",
  status: "assigned",
  job_type: "installation",
  ...over,
});

describe("getInstallationDeadline", () => {
  it("should return the deadline of the open installation job", () => {
    expect(getInstallationDeadline([job()])).toBe("2026-10-24T11:15:00.000Z");
  });

  it("should return null when the booking has no job", () => {
    expect(getInstallationDeadline([])).toBeNull();
    expect(getInstallationDeadline(null)).toBeNull();
    expect(getInstallationDeadline(undefined)).toBeNull();
  });

  it("should ignore a completed job, another job type and a job with no deadline", () => {
    expect(
      getInstallationDeadline([
        job({ status: "completed" }),
        job({ job_type: "cleaning" }),
        job({ deadline_at: null }),
      ]),
    ).toBeNull();
  });

  it("should return the earliest deadline when several installation jobs are open", () => {
    expect(
      getInstallationDeadline([
        job({ deadline_at: "2026-10-24T12:00:00.000Z" }),
        job({ deadline_at: "2026-10-24T11:00:00.000Z" }),
      ]),
    ).toBe("2026-10-24T11:00:00.000Z");
  });
});

describe("isDeadlineMoved", () => {
  const pickup = "2026-10-24T12:15:00.000Z";

  it("should be true when the deadline is not 60 minutes before the pickup", () => {
    expect(isDeadlineMoved("2026-10-24T11:45:00.000Z", pickup)).toBe(true);
  });

  it("should be false when the deadline is the base one", () => {
    expect(isDeadlineMoved("2026-10-24T11:15:00.000Z", pickup)).toBe(false);
  });

  it("should be false when there is no deadline or no pickup time", () => {
    expect(isDeadlineMoved(null, pickup)).toBe(false);
    expect(isDeadlineMoved("2026-10-24T11:15:00.000Z", undefined)).toBe(false);
  });
});

describe("flight status", () => {
  it("should say a flight has landed only for the landed status", () => {
    expect(isFlightLanded("landed")).toBe(true);
    expect(isFlightLanded("scheduled")).toBe(false);
  });

  it("should show the status badge for a landed flight, or when there is no timing pill", () => {
    expect(shouldShowStatusBadge("landed", true)).toBe(true);
    expect(shouldShowStatusBadge("cancelled", false)).toBe(true);
    expect(shouldShowStatusBadge("delayed", true)).toBe(false);
  });
});

describe("flight time format", () => {
  it("should write a clock with the short zone name of the airport", () => {
    expect(formatClock("2026-10-24T11:45:00.000Z", "Asia/Dubai")).toBe("15:45 GST");
  });

  it("should write a date and time as the design does, and a dash when the time is missing", () => {
    expect(formatFlightDateTime("2026-10-24T12:30:00.000Z", "Asia/Dubai")).toBe("16:30 · 24 Oct 2026");
    expect(formatFlightDateTime(null, "Asia/Dubai")).toBe("-");
  });
});

describe("getSyncNote", () => {
  it("should say a landed flight is no longer refreshed, even when the sync is old", () => {
    expect(getSyncNote("landed", true, true)).toBe(". Landed: this flight is no longer refreshed.");
  });

  it("should warn about old data only for a flight that synced and has not landed", () => {
    expect(getSyncNote("scheduled", true, true)).toBe(". Times may be wrong.");
    expect(getSyncNote("scheduled", false, true)).toBe("");
    expect(getSyncNote("scheduled", true, false)).toBe("");
  });
});

describe("getBannerDetail", () => {
  const estimate = "2026-10-24T11:45:00.000Z";

  it("should add the moved deadline to the estimate", () => {
    expect(
      getBannerDetail("EK203", estimate, "2026-10-24T11:15:00.000Z", "2026-10-24T12:45:00.000Z", "Asia/Dubai"),
    ).toBe("EK203 · Estimated 15:45 GST. Installation deadline moved to 15:15 GST.");
  });

  it("should show only the estimate when the deadline did not move, and a dash with no estimate", () => {
    expect(getBannerDetail("EK203", estimate, null, null, "Asia/Dubai")).toBe("EK203 · Estimated 15:45 GST.");
    expect(getBannerDetail("EK203", null, null, null, "Asia/Dubai")).toBe("EK203 · Estimated -.");
  });
});
