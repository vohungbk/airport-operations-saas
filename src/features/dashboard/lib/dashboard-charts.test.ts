import { describe, expect, it } from "vitest";

import { STATUS_VARIANT as BOOKING_VARIANT } from "@/features/bookings/components/booking-status-badge";
import { STATUS_VARIANT as SEAT_VARIANT } from "@/features/seats/components/seat-status-badge";
import { BOOKING_STATUSES } from "@/features/bookings/lib/booking-status";
import {
  DASHBOARD_CHARTS,
  getChartsForRole,
} from "@/features/dashboard/lib/dashboard-charts";
import { DASHBOARD_METRICS } from "@/features/dashboard/lib/dashboard-metrics";
import { INCIDENT_SEVERITIES } from "@/features/incidents/lib/incident-severity";
import { JOB_STATUSES } from "@/features/jobs/lib/job-status";
import { SEAT_STATUSES } from "@/features/seats/lib/seat-status";

const chart = (id: string) => DASHBOARD_CHARTS.find((c) => c.id === id)!;

describe("the charts of the dashboard (VI-F01-S07)", () => {
  it("should have one chart for each group of figures: seats, bookings, jobs and open incidents", () => {
    expect(DASHBOARD_CHARTS.map((c) => [c.module, c.id])).toEqual([
      ["inventory", "seats_by_status"],
      ["bookings", "bookings_by_status"],
      ["jobs", "jobs_by_status"],
      ["incidents", "open_incidents_by_severity"],
    ]);
  });

  it.each([
    ["seats_by_status", SEAT_STATUSES],
    ["bookings_by_status", BOOKING_STATUSES],
    ["jobs_by_status", JOB_STATUSES],
    ["open_incidents_by_severity", INCIDENT_SEVERITIES],
  ] as const)("should have a bar for every value of the enum behind %s, each with a word", (id, values) => {
    const categories = chart(id).categories;

    expect(categories.map((c) => c.key).sort()).toEqual([...values].sort());
    for (const category of categories) {
      expect(category.label.trim(), category.key).not.toBe("");
    }
  });

  it("should count seats, bookings and jobs by their status, in the table of each", () => {
    expect(chart("seats_by_status").source).toBe("seats");
    expect(chart("bookings_by_status").source).toBe("bookings");
    expect(chart("jobs_by_status").source).toBe("technician_jobs");
    for (const id of ["seats_by_status", "bookings_by_status", "jobs_by_status"]) {
      for (const category of chart(id).categories) {
        expect(category.filters).toEqual({ status: category.key });
      }
    }
  });

  it("should draw a bar in the tone of the status badge, so a status has one tone everywhere", () => {
    const tones = (id: string) => Object.fromEntries(chart(id).categories.map((c) => [c.key, c.tone]));

    expect(tones("seats_by_status")).toEqual(SEAT_VARIANT);
    expect(tones("bookings_by_status")).toEqual(BOOKING_VARIANT);
  });

  it("should count only open incidents, by severity, with Critical first and set apart", () => {
    const categories = chart("open_incidents_by_severity").categories;

    expect(categories.map((c) => c.key)).toEqual(["critical", "high", "medium", "low"]);
    expect(categories.every((c) => c.filters.status === "open")).toBe(true);
    expect(categories.filter((c) => c.emphasis).map((c) => c.key)).toEqual(["critical"]);
    expect(categories[0].tone).toBe("destructive");
  });

  it("should have the same filters as the count card for every bar that has a card (AC07)", () => {
    const keyOf = (source: string, filters: Record<string, string>) =>
      `${source}|${JSON.stringify(Object.entries(filters).sort())}`;
    const cards = new Map(DASHBOARD_METRICS.map((m) => [keyOf(m.source, m.filters), m.id]));
    const matched = DASHBOARD_CHARTS.flatMap((c) =>
      c.categories.map((category) => cards.get(keyOf(c.source, category.filters))).filter(Boolean),
    );

    expect(matched.sort()).toEqual(
      [
        "bookings_in_progress",
        "bookings_pending",
        "incidents_critical_open",
        "jobs_assigned",
        "jobs_in_progress",
        "seats_available",
        "seats_quarantine",
      ].sort(),
    );
  });
});

describe("getChartsForRole", () => {
  const ids = (role: Parameters<typeof getChartsForRole>[0]) => getChartsForRole(role).map((c) => c.id);

  it.each(["admin", "operations_manager"] as const)("should give %s all four charts", (role) => {
    expect(ids(role)).toEqual([
      "seats_by_status",
      "bookings_by_status",
      "jobs_by_status",
      "open_incidents_by_severity",
    ]);
  });

  it("should give a technician the jobs and incidents charts, as for the cards", () => {
    expect(ids("technician")).toEqual(["jobs_by_status", "open_incidents_by_severity"]);
  });

  it("should give a partner user the bookings and incidents charts, and no seat or job chart", () => {
    expect(ids("partner_user")).toEqual(["bookings_by_status", "open_incidents_by_severity"]);
  });
});
