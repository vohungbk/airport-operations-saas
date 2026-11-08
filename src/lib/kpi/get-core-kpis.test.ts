import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { getCoreKpis } from "@/lib/kpi/get-core-kpis";
import type { Database } from "@/types/database.types";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

type RpcResult = { data: unknown; error: { message: string } | null };

function fakeClient(answers: Record<string, RpcResult>) {
  const rpc = vi.fn(async (name: string) => answers[name] ?? { data: null, error: { message: "no answer" } });

  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

const PERIOD = { from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" };

const ANSWERS: Record<string, RpcResult> = {
  kpi_correct_seat_figures: { data: [{ completed_bookings: 240, with_result: 240, matched: 238 }], error: null },
  kpi_on_time_readiness_figures: { data: [{ family_ready_bookings: 240, with_deadline: 240, on_time: 234 }], error: null },
  kpi_traceability_figures: { data: [{ completed_bookings: "240", traced_bookings: "240" }], error: null },
  kpi_incident_figures: { data: [{ completed_bookings: 240, incidents: 3 }], error: null },
  kpi_commercial_figures: { data: [{ completed_bookings: 240, with_revenue: 240, partner_revenue: "6000.00" }], error: null },
};

describe("getCoreKpis (VI-F05-S01, AC03)", () => {
  it("should return the five core KPIs for the period", async () => {
    const { client, rpc } = fakeClient(ANSWERS);

    const result = await getCoreKpis(PERIOD, client);

    expect(result).toEqual({
      ok: true,
      kpis: {
        correct_seat: { state: "value", percent: 99.2, numerator: 238, denominator: 240, excluded: 0 },
        family_ready_on_time: { state: "value", percent: 97.5, numerator: 234, denominator: 240, excluded: 0 },
        traceability: { state: "value", percent: 100, numerator: 240, denominator: 240, excluded: 0 },
        incidents: { state: "value", incidents: 3, completed_bookings: 240, percent: 1.25 },
        commercial: { state: "value", amount: 6000, excluded: 0 },
      },
    });
    for (const name of ["kpi_traceability_figures", "kpi_incident_figures", "kpi_commercial_figures"]) {
      expect(rpc).toHaveBeenCalledWith(name, { p_from: PERIOD.from, p_to: PERIOD.to });
    }
  });

  it("should say No data for every figure when the period has no completed booking (E1, E4)", async () => {
    const { client } = fakeClient({
      kpi_correct_seat_figures: { data: [{ completed_bookings: 0, with_result: 0, matched: 0 }], error: null },
      kpi_on_time_readiness_figures: { data: [{ family_ready_bookings: 0, with_deadline: 0, on_time: 0 }], error: null },
      kpi_traceability_figures: { data: [{ completed_bookings: 0, traced_bookings: 0 }], error: null },
      kpi_incident_figures: { data: [{ completed_bookings: 0, incidents: 0 }], error: null },
      kpi_commercial_figures: { data: [{ completed_bookings: 0, with_revenue: 0, partner_revenue: 0 }], error: null },
    });

    const result = await getCoreKpis(PERIOD, client);

    expect(result).toMatchObject({
      ok: true,
      kpis: {
        correct_seat: { state: "no_data" },
        family_ready_on_time: { state: "no_data" },
        traceability: { state: "no_data" },
        incidents: { state: "no_data" },
        commercial: { state: "no_data" },
      },
    });
  });

  it("should refuse an invalid period before it reaches the database", async () => {
    const { client, rpc } = fakeClient(ANSWERS);

    expect(await getCoreKpis({ from: PERIOD.to, to: PERIOD.from }, client)).toEqual({ ok: false, reason: "invalid_period" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("should report unavailable when any one of the reads fails, never a made-up figure", async () => {
    const { client } = fakeClient({ ...ANSWERS, kpi_incident_figures: { data: null, error: { message: "boom" } } });

    expect(await getCoreKpis(PERIOD, client)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("should report unavailable when a call throws", async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error("network")) } as unknown as SupabaseClient<Database>;

    expect(await getCoreKpis(PERIOD, client)).toEqual({ ok: false, reason: "unavailable" });
  });
});
