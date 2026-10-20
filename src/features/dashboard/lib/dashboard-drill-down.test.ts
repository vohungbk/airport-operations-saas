import { describe, expect, it } from "vitest";

import {
  DASHBOARD_METRICS,
  getMetricHref,
  getMetricsForRole,
  type DashboardMetric,
} from "@/features/dashboard/lib/dashboard-metrics";
import { bookingsQuerySchema } from "@/features/bookings/schemas/bookings-query.schema";
import { parseIncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";
import { parseJobsQuery } from "@/features/jobs/schemas/jobs-query.schema";
import { seatsQuerySchema } from "@/features/seats/schemas/seats-query.schema";

/** The query string of the link, as the list page receives it. */
function paramsOf(metric: DashboardMetric): Record<string, string> {
  const url = new URL(getMetricHref(metric), "http://localhost");

  return Object.fromEntries(url.searchParams);
}

/** Parses the link with the parser the destination list page itself uses. */
function parsedByList(metric: DashboardMetric): Record<string, unknown> {
  const raw = paramsOf(metric);

  switch (metric.source) {
    case "seats":
      return seatsQuerySchema.parse(raw);
    case "bookings":
      return bookingsQuerySchema.parse(raw);
    case "technician_jobs":
      return parseJobsQuery(raw).query;
    case "incidents":
      return parseIncidentsQuery(raw).query;
  }
}

describe("dashboard drill-down", () => {
  it.each(DASHBOARD_METRICS.map((metric) => [metric.id, metric]))(
    "should open the list of %s with exactly the filters the count uses",
    (_id, metric) => {
      const parsed = parsedByList(metric);

      for (const [column, value] of Object.entries(metric.filters)) {
        expect(parsed[column]).toBe(value);
      }
    },
  );

  it.each(DASHBOARD_METRICS.map((metric) => [metric.id, metric]))(
    "should add no other filter than the metric's own when %s opens its list",
    (_id, metric) => {
      expect(Object.keys(paramsOf(metric)).sort()).toEqual(
        Object.keys(metric.filters).sort(),
      );
    },
  );

  it.each([
    ["seats", "/seats"],
    ["bookings", "/bookings"],
    ["technician_jobs", "/jobs"],
    ["incidents", "/incidents"],
  ] as const)("should send a %s metric to %s", (source, path) => {
    const inSource = DASHBOARD_METRICS.filter((m) => m.source === source);

    expect(inSource.length).toBeGreaterThan(0);
    for (const metric of inSource) {
      expect(getMetricHref(metric).startsWith(`${path}?`)).toBe(true);
    }
  });

  it("should not drill a role into a list it cannot open", () => {
    const listsOf = (role: Parameters<typeof getMetricsForRole>[0]) =>
      new Set(getMetricsForRole(role).map((metric) => metric.listPath));

    expect(listsOf("partner_user")).toEqual(new Set(["/bookings", "/incidents"]));
    expect(listsOf("technician")).toEqual(new Set(["/jobs", "/incidents"]));
    expect(listsOf("admin")).toEqual(
      new Set(["/seats", "/bookings", "/jobs", "/incidents"]),
    );
  });

  it("should show that a list drops a filter it does not recognise, which is why the link is checked", () => {
    const parsed = seatsQuerySchema.parse({ status: "not-a-status" });

    expect(parsed.status).toBeUndefined();
  });
});
