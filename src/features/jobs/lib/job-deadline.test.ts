import { describe, expect, it, vi } from "vitest";

import {
  applyJobDeadlineFilter,
  buildJobDeadlineView,
  formatJobDeadline,
  getJobDeadlineRange,
  isJobOverdue,
} from "@/features/jobs/lib/job-deadline";

const NOW = new Date("2026-11-04T10:00:00Z");

describe("isJobOverdue (UI-F06-T01, AC04)", () => {
  it("should be overdue when an open job is past its deadline", () => {
    expect(isJobOverdue({ status: "assigned", deadline_at: "2026-11-04T09:00:00Z" }, NOW)).toBe(true);
    expect(isJobOverdue({ status: "in_progress", deadline_at: "2026-11-04T09:59:00Z" }, NOW)).toBe(true);
  });

  it("should never be overdue when the job has no deadline", () => {
    expect(isJobOverdue({ status: "assigned", deadline_at: null }, NOW)).toBe(false);
  });

  it("should not be overdue at the deadline itself or before it", () => {
    expect(isJobOverdue({ status: "assigned", deadline_at: NOW.toISOString() }, NOW)).toBe(false);
    expect(isJobOverdue({ status: "assigned", deadline_at: "2026-11-04T10:01:00Z" }, NOW)).toBe(false);
  });

  it("should not be overdue once the job is completed or cancelled", () => {
    for (const status of ["completed", "cancelled"] as const) {
      expect(isJobOverdue({ status, deadline_at: "2026-11-01T09:00:00Z" }, NOW), status).toBe(false);
    }
  });
});

describe("getJobDeadlineRange", () => {
  it("should ask for open jobs with a deadline before now for Overdue", () => {
    expect(getJobDeadlineRange("overdue", NOW)).toEqual({ open_only: true, before: NOW.toISOString() });
  });

  it("should ask for the UTC day of now for Today", () => {
    expect(getJobDeadlineRange("today", NOW)).toEqual({
      open_only: false,
      from: "2026-11-04T00:00:00.000Z",
      before: "2026-11-05T00:00:00.000Z",
    });
  });

  it("should start the day at midnight UTC even just before the next day", () => {
    const late = new Date("2026-11-04T23:59:59Z");

    expect(getJobDeadlineRange("today", late).from).toBe("2026-11-04T00:00:00.000Z");
  });
});

describe("formatJobDeadline", () => {
  it("should write the date and time in the zone of the airport, as the design does", () => {
    expect(formatJobDeadline("2026-11-04T10:30:00Z", "Asia/Dubai")).toBe("04 Nov 2026 14:30 GST");
  });
});

describe("buildJobDeadlineView", () => {
  it("should say nothing is stored when the job has no deadline", () => {
    expect(buildJobDeadlineView({ status: "assigned", deadline_at: null }, "Asia/Dubai", NOW)).toEqual({ kind: "none" });
  });

  it("should give an on-time date for a deadline still to come", () => {
    expect(
      buildJobDeadlineView({ status: "assigned", deadline_at: "2026-11-04T10:30:00Z" }, "Asia/Dubai", NOW),
    ).toEqual({ kind: "on_time", label: "04 Nov 2026 14:30 GST" });
  });

  it("should give an overdue date for an open job past its deadline", () => {
    expect(
      buildJobDeadlineView({ status: "in_progress", deadline_at: "2026-11-04T05:00:00Z" }, "Asia/Dubai", NOW),
    ).toEqual({ kind: "overdue", label: "04 Nov 2026 09:00 GST" });
  });
});

describe("applyJobDeadlineFilter", () => {
  function chain() {
    const query = {
      in: vi.fn(() => query),
      gte: vi.fn(() => query),
      lt: vi.fn(() => query),
    };
    return query;
  }

  it("should keep open jobs with a deadline before now for Overdue", () => {
    const query = chain();

    applyJobDeadlineFilter(query, "overdue", NOW);

    expect(query.in).toHaveBeenCalledWith("status", ["assigned", "in_progress"]);
    expect(query.lt).toHaveBeenCalledWith("deadline_at", NOW.toISOString());
    expect(query.gte).not.toHaveBeenCalled();
  });

  it("should keep jobs with a deadline inside the day for Today, whatever their status", () => {
    const query = chain();

    applyJobDeadlineFilter(query, "today", NOW);

    expect(query.in).not.toHaveBeenCalled();
    expect(query.gte).toHaveBeenCalledWith("deadline_at", "2026-11-04T00:00:00.000Z");
    expect(query.lt).toHaveBeenCalledWith("deadline_at", "2026-11-05T00:00:00.000Z");
  });
});
