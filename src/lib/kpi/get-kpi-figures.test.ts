import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { getRateFigures, getTodayFigures } from "@/lib/kpi/get-kpi-figures";
import type { Database } from "@/types/database.types";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

type RpcResult = { data: unknown; error: { message: string } | null };

/** A client whose `rpc` answers by function name; `calls` records what it was asked. */
function fakeClient(answers: Record<string, RpcResult>) {
  const rpc = vi.fn(async (name: string) => answers[name] ?? { data: null, error: { message: "no answer" } });

  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

const PERIOD = { from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" };

describe("getTodayFigures (VI-F05-T02, AC01, AC02)", () => {
  it("should return the two counts of the day as numbers", async () => {
    const { client, rpc } = fakeClient({
      kpi_today_figures: { data: [{ arrivals_today: "12", installations_due: 5 }], error: null },
    });

    const figures = await getTodayFigures(new Date("2026-11-09T10:00:00.000Z"), client);

    expect(figures).toEqual({ arrivals_today: 12, installations_due: 5 });
    expect(rpc).toHaveBeenCalledWith("kpi_today_figures", { p_now: "2026-11-09T10:00:00.000Z" });
  });

  it("should give null, never 0, when the read fails", async () => {
    const { client } = fakeClient({ kpi_today_figures: { data: null, error: { message: "boom" } } });

    expect(await getTodayFigures(new Date(), client)).toEqual({ arrivals_today: null, installations_due: null });
  });

  it("should give null when the call throws", async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error("network")) } as unknown as SupabaseClient<Database>;

    expect(await getTodayFigures(new Date(), client)).toEqual({ arrivals_today: null, installations_due: null });
  });
});

describe("getRateFigures (VI-F05-T02, AC04 to AC07)", () => {
  const answers = {
    kpi_correct_seat_figures: { data: [{ completed_bookings: 10, with_result: 10, matched: 9 }], error: null },
    kpi_on_time_readiness_figures: { data: [{ family_ready_bookings: 10, with_deadline: 10, on_time: 8 }], error: null },
  };

  it("should return both rates for a valid period", async () => {
    const { client, rpc } = fakeClient(answers);

    const result = await getRateFigures(PERIOD, client);

    expect(result).toMatchObject({
      ok: true,
      figures: { correct_seat: { state: "value", percent: 90 }, on_time_readiness: { state: "value", percent: 80 } },
    });
    expect(rpc).toHaveBeenCalledWith("kpi_correct_seat_figures", { p_from: PERIOD.from, p_to: PERIOD.to });
  });

  it("should reject an invalid period before it reaches the database", async () => {
    const { client, rpc } = fakeClient(answers);

    const result = await getRateFigures({ from: PERIOD.to, to: PERIOD.from }, client);

    expect(result).toMatchObject({ ok: false, reason: "invalid_period" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("should say No data for a period with no bookings", async () => {
    const { client } = fakeClient({
      kpi_correct_seat_figures: { data: [{ completed_bookings: 0, with_result: 0, matched: 0 }], error: null },
      kpi_on_time_readiness_figures: { data: [{ family_ready_bookings: 0, with_deadline: 0, on_time: 0 }], error: null },
    });

    const result = await getRateFigures(PERIOD, client);

    expect(result).toMatchObject({ ok: true, figures: { correct_seat: { state: "no_data" }, on_time_readiness: { state: "no_data" } } });
  });

  it("should report unavailable when one of the reads fails", async () => {
    const { client } = fakeClient({ ...answers, kpi_on_time_readiness_figures: { data: null, error: { message: "boom" } } });

    expect(await getRateFigures(PERIOD, client)).toEqual({ ok: false, reason: "unavailable" });
  });
});
