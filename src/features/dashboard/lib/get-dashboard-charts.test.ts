import { describe, expect, it, vi } from "vitest";

import { DASHBOARD_CHARTS } from "@/features/dashboard/lib/dashboard-charts";
import { DASHBOARD_MODULE_RELEASED } from "@/features/dashboard/lib/dashboard-metrics";
import { getDashboardCharts } from "@/features/dashboard/lib/get-dashboard-charts";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

type CountResult = { count: number | null; error: unknown };
type Call = { table: string; filters: [string, string][] };

/** A client whose count query resolves to what `answer` gives for the call. */
function fakeClient(answer: (call: Call) => CountResult | Promise<CountResult>) {
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    const call: Call = { table, filters: [] };
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: string) => {
        call.filters.push([column, value]);
        return query;
      }),
      then: (resolve: (r: CountResult) => void, reject: (e: unknown) => void) => {
        calls.push(call);
        return Promise.resolve(answer(call)).then(resolve, reject);
      },
    };
    return query;
  });
  return { client: { from } as never, calls };
}

const all = (count: number) => ({ count, error: null });

describe("getDashboardCharts (VI-F01-S07)", () => {
  it("should count every bar of every chart of an admin, one query for each, in the table of the chart", async () => {
    const { client, calls } = fakeClient(() => all(2));

    const charts = await getDashboardCharts("admin", client);

    expect(charts.map((c) => c.chart.id)).toEqual(DASHBOARD_CHARTS.map((c) => c.id));
    expect(calls).toHaveLength(DASHBOARD_CHARTS.reduce((n, c) => n + c.categories.length, 0));
    expect(new Set(calls.map((c) => c.table))).toEqual(
      new Set(["seats", "bookings", "technician_jobs", "incidents"]),
    );
  });

  it("should give each bar the count of its own filters, so a bar has the number of the card with the same filters", async () => {
    const { client } = fakeClient(({ table, filters }) => {
      const status = filters.find(([column]) => column === "status")?.[1];
      const severity = filters.find(([column]) => column === "severity")?.[1];
      if (table === "seats" && status === "available") return all(39);
      if (table === "incidents" && status === "open" && severity === "critical") return all(4);
      return all(0);
    });

    const charts = await getDashboardCharts("admin", client);
    const value = (chartId: string, key: string) =>
      charts.find((c) => c.chart.id === chartId)!.bars.find((b) => b.category.key === key)!.value;

    expect(value("seats_by_status", "available")).toBe(39);
    expect(value("seats_by_status", "quarantine")).toBe(0);
    expect(value("open_incidents_by_severity", "critical")).toBe(4);
    expect(value("open_incidents_by_severity", "high")).toBe(0);
  });

  it("should leave a bar whose count failed as null, never as 0, and keep the others", async () => {
    const { client } = fakeClient(({ table, filters }) =>
      table === "seats" && filters[0][1] === "retired" ? { count: null, error: { message: "boom" } } : all(1),
    );

    const seats = (await getDashboardCharts("admin", client)).find((c) => c.chart.id === "seats_by_status")!;

    expect(seats.bars.find((b) => b.category.key === "retired")!.value).toBeNull();
    expect(seats.bars.filter((b) => b.value === 1)).toHaveLength(6);
  });

  it("should leave a bar as null, and not fail the page, when its query throws", async () => {
    const { client } = fakeClient(() => {
      throw new Error("network");
    });

    const charts = await getDashboardCharts("admin", client);

    expect(charts.flatMap((c) => c.bars).every((b) => b.value === null)).toBe(true);
  });

  it("should read only the charts of the modules a technician can open", async () => {
    const { client, calls } = fakeClient(() => all(1));

    const charts = await getDashboardCharts("technician", client);

    expect(charts.map((c) => c.chart.id)).toEqual(["jobs_by_status", "open_incidents_by_severity"]);
    expect(new Set(calls.map((c) => c.table))).toEqual(new Set(["technician_jobs", "incidents"]));
  });

  it("should read only the bookings and incidents charts for a partner user, and no seat or job table", async () => {
    const { client, calls } = fakeClient(() => all(1));

    const charts = await getDashboardCharts("partner_user", client);

    expect(charts.map((c) => c.chart.id)).toEqual(["bookings_by_status", "open_incidents_by_severity"]);
    expect(calls.some((c) => c.table === "seats" || c.table === "technician_jobs")).toBe(false);
  });

  it("should make no query, and give no chart, for a module that is not released", async () => {
    const { client, calls } = fakeClient(() => all(1));

    const charts = await getDashboardCharts("admin", client, { ...DASHBOARD_MODULE_RELEASED, jobs: false });

    expect(charts.map((c) => c.chart.id)).not.toContain("jobs_by_status");
    expect(calls.some((c) => c.table === "technician_jobs")).toBe(false);
  });

  it("should make no query at all when the role has no chart", async () => {
    const { client, calls } = fakeClient(() => all(1));

    const charts = await getDashboardCharts("admin", client, {
      inventory: false,
      bookings: false,
      jobs: false,
      incidents: false,
    });

    expect(charts).toEqual([]);
    expect(calls).toEqual([]);
  });
});
