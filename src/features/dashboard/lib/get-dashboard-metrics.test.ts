import { describe, expect, it, vi } from "vitest";

import {
  countMetric,
  getDashboardMetrics,
} from "@/features/dashboard/lib/get-dashboard-metrics";
import { DASHBOARD_METRICS } from "@/features/dashboard/lib/dashboard-metrics";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

type CountResult = { count: number | null; error: unknown };

/** A client whose count query resolves to what `answer` gives for the call. */
function fakeClient(answer: (table: string, filters: [string, string][]) => CountResult | Promise<CountResult>) {
  const from = vi.fn((table: string) => {
    const filters: [string, string][] = [];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: string) => {
        filters.push([column, value]);
        return query;
      }),
      then: (resolve: (r: CountResult) => void, reject: (e: unknown) => void) =>
        Promise.resolve(answer(table, filters)).then(resolve, reject),
    };
    return query;
  });
  return { from } as never;
}

const metric = (id: string) => DASHBOARD_METRICS.find((m) => m.id === id)!;

describe("countMetric", () => {
  it("should count the rows of the table that match every filter of the metric", async () => {
    const seen: unknown[] = [];
    const client = fakeClient((table, filters) => {
      seen.push([table, filters]);
      return { count: 7, error: null };
    });

    await expect(countMetric(client, metric("incidents_critical_open"))).resolves.toBe(7);
    expect(seen).toEqual([
      [
        "incidents",
        [
          ["status", "open"],
          ["severity", "critical"],
        ],
      ],
    ]);
  });

  it("should return a real zero as zero", async () => {
    const client = fakeClient(() => ({ count: 0, error: null }));

    await expect(countMetric(client, metric("seats_available"))).resolves.toBe(0);
  });

  it("should return null, not zero, when the query fails or gives no count", async () => {
    const failed = fakeClient(() => ({ count: null, error: { code: "XX000" } }));
    const noCount = fakeClient(() => ({ count: null, error: null }));

    await expect(countMetric(failed, metric("seats_available"))).resolves.toBeNull();
    await expect(countMetric(noCount, metric("seats_available"))).resolves.toBeNull();
  });
});

describe("getDashboardMetrics", () => {
  it("should read only the metrics of the role", async () => {
    const tables: string[] = [];
    const client = fakeClient((table) => {
      tables.push(table);
      return { count: 1, error: null };
    });

    const results = await getDashboardMetrics("partner_user", client);

    expect(results.map((r) => r.metric.id)).toEqual([
      "bookings_pending",
      "bookings_in_progress",
      "incidents_open",
      "incidents_critical_open",
    ]);
    expect(tables).not.toContain("seats");
    expect(tables).not.toContain("technician_jobs");
  });

  it("should leave a gap in one figure when its query fails or throws, and keep the others", async () => {
    const client = fakeClient((table) => {
      if (table === "bookings") {
        return { count: null, error: { code: "XX000" } };
      }
      if (table === "technician_jobs") {
        throw new Error("boom");
      }
      return { count: 4, error: null };
    });

    const results = await getDashboardMetrics("admin", client);
    const valueOf = (id: string) => results.find((r) => r.metric.id === id)!.value;

    expect(valueOf("bookings_pending")).toBeNull();
    expect(valueOf("jobs_assigned")).toBeNull();
    expect(valueOf("seats_available")).toBe(4);
    expect(valueOf("incidents_open")).toBe(4);
  });
});
