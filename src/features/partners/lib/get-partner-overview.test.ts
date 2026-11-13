import { beforeEach, describe, expect, it, vi } from "vitest";

const getCoreKpisMock = vi.hoisted(() => vi.fn());
const getTodayMock = vi.hoisted(() => vi.fn());
const getFinanceMock = vi.hoisted(() => vi.fn());
const countMetricMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/kpi/get-core-kpis", () => ({ getCoreKpis: getCoreKpisMock }));
vi.mock("@/lib/kpi/get-kpi-figures", () => ({ getTodayFigures: getTodayMock }));
vi.mock("@/features/partners/lib/get-partner-finance", () => ({ getPartnerFinance: getFinanceMock }));
vi.mock("@/features/dashboard/lib/get-dashboard-metrics", () => ({ countMetric: countMetricMock }));

import { getPartnerOverview } from "@/features/partners/lib/get-partner-overview";

const NOW = new Date("2026-10-24T09:00:00.000Z");

/** A client whose queries resolve to a count, like PostgREST's. The client itself must not be thenable. */
function clientReturning(result: { count: number | null; error: unknown }) {
  return { from: () => queryReturning(result) };
}

/** A query builder whose every call returns itself and that resolves to a count. */
function queryReturning(result: { count: number | null; error: unknown }) {
  const query: Record<string, unknown> = {
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const method of ["select", "gte", "lt", "in"]) query[method] = () => query;

  return query;
}

describe("getPartnerOverview", () => {
  beforeEach(() => {
    createClientMock.mockReset().mockResolvedValue(clientReturning({ count: 26, error: null }));
    getTodayMock.mockReset().mockResolvedValue({ arrivals_today: 18, installations_due: 0 });
    countMetricMock.mockReset().mockResolvedValue(12);
    getCoreKpisMock.mockReset().mockResolvedValue({ ok: false, reason: "unavailable" });
    getFinanceMock.mockReset().mockResolvedValue({ settlement: null, invoices: [], terms: null });
  });

  it("should read the KPIs for the month of now, as the signed-in user", async () => {
    await getPartnerOverview(NOW);

    expect(getCoreKpisMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" }),
      expect.anything(),
    );
  });

  it("should show a dash for the figure that failed and still load the others", async () => {
    getFinanceMock.mockRejectedValue(new Error("Could not read the finance of the partner"));

    const view = await getPartnerOverview(NOW);

    expect(view.tiles.find((item) => item.label === "Rentals today")?.value).toBe("18");
    expect(view.tiles.find((item) => item.label === "Upcoming reservations")?.value).toBe("26");
    expect(view.revenue.every((row) => row.value === "—")).toBe(true);
  });

  it("should show a dash, not 0, when a count could not be read", async () => {
    createClientMock.mockResolvedValue(clientReturning({ count: null, error: { message: "denied" } }));
    countMetricMock.mockResolvedValue(null);

    const view = await getPartnerOverview(NOW);

    expect(view.tiles.find((item) => item.label === "Active rentals")?.value).toBe("—");
    expect(view.tiles.find((item) => item.label === "Upcoming reservations")?.value).toBe("—");
  });
});
