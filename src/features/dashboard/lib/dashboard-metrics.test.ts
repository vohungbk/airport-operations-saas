import { describe, expect, it } from "vitest";

import {
  DASHBOARD_METRICS,
  getMetricHref,
  getMetricsForRole,
} from "@/features/dashboard/lib/dashboard-metrics";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";
import { Constants } from "@/types/database.types";

const idsFor = (role: Parameters<typeof getMetricsForRole>[0]) =>
  getMetricsForRole(role).map((metric) => metric.id);

describe("DASHBOARD_METRICS", () => {
  it("should have a unique id, a label and a written formula for every metric", () => {
    const ids = DASHBOARD_METRICS.map((metric) => metric.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const metric of DASHBOARD_METRICS) {
      expect(metric.label).toBeTruthy();
      expect(metric.formula).toBeTruthy();
    }
  });

  it("should only filter on values of the enums, so a count and its list can agree", () => {
    const statuses: Record<string, readonly string[]> = {
      seats: Constants.public.Enums.seat_status,
      bookings: Constants.public.Enums.booking_status,
      technician_jobs: Constants.public.Enums.technician_job_status,
      incidents: Constants.public.Enums.incident_status,
    };

    for (const metric of DASHBOARD_METRICS) {
      expect(statuses[metric.source]).toContain(metric.filters.status);
      if (metric.filters.severity) {
        expect(Constants.public.Enums.incident_severity).toContain(
          metric.filters.severity,
        );
      }
    }
  });
});

describe("getMetricsForRole", () => {
  it.each(["admin", "operations_manager"] as const)(
    "should give the %s role every metric",
    (role) => {
      expect(idsFor(role)).toEqual(DASHBOARD_METRICS.map((metric) => metric.id));
    },
  );

  it("should give a technician only the jobs and incidents they can open", () => {
    expect(idsFor("technician")).toEqual([
      "jobs_assigned",
      "jobs_in_progress",
      "incidents_open",
      "incidents_critical_open",
    ]);
  });

  it("should give a partner user the bookings and incidents of their partner and no seats", () => {
    expect(idsFor("partner_user")).toEqual([
      "bookings_pending",
      "bookings_in_progress",
      "incidents_open",
      "incidents_critical_open",
    ]);
  });
});

describe("getMetricsForRole for every role (VI-F01-S04)", () => {
  it.each(ROLES)(
    "should give %s only the metrics of lists it holds a permission for",
    (role) => {
      const shown = new Set(getMetricsForRole(role).map((metric) => metric.id));

      for (const metric of DASHBOARD_METRICS) {
        expect(shown.has(metric.id), `${role}: ${metric.id}`).toBe(
          hasAnyPermission(role, metric.permissions),
        );
      }
    },
  );
});

describe("getMetricHref", () => {
  it.each([
    ["seats_available", "/seats?status=available"],
    ["bookings_in_progress", "/bookings?status=in_progress"],
    ["jobs_assigned", "/jobs?status=assigned"],
    ["incidents_open", "/incidents?status=open"],
    ["incidents_critical_open", "/incidents?status=open&severity=critical"],
  ])("should link %s to %s", (id, href) => {
    expect(getMetricHref(DASHBOARD_METRICS.find((m) => m.id === id)!)).toBe(href);
  });
});
