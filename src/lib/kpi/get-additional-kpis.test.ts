import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { getAdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import type { Database } from "@/types/database.types";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

type RpcResult = { data: unknown; error: { message: string } | null };

function fakeClient(answers: Record<string, RpcResult>) {
  const rpc = vi.fn(async (name: string) => answers[name] ?? { data: null, error: { message: "no answer" } });

  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

const PERIOD = { from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" };

const BOOKING_ROW = {
  completed_bookings: "240",
  paid_days: "1248",
  rented_days: "340",
  replacements: 2,
  refund_amount: "150.00",
  refunded_bookings: 3,
  installation_jobs: 240,
  installation_timed: 240,
  installation_minutes: "2880",
  prepared_bookings: 240,
  preparation_timed: 240,
  preparation_minutes: "5760",
};

const INVENTORY_ROW = { seats_in_service: 40, available_seats: 16, available_seat_days: "500", airport_codes: "DXB" };

const ANSWERS: Record<string, RpcResult> = {
  kpi_additional_figures: { data: [BOOKING_ROW], error: null },
  kpi_seat_inventory_figures: { data: [INVENTORY_ROW], error: null },
};

describe("getAdditionalKpis (VI-F05-S02, AC01)", () => {
  it("should return the additional KPIs for the period, reading the numbers PostgREST sends as strings", async () => {
    const { client, rpc } = fakeClient(ANSWERS);

    const result = await getAdditionalKpis(PERIOD, client);

    expect(result).toEqual({
      ok: true,
      kpis: {
        seat_utilisation: { state: "value", value: 68 },
        average_rental_duration: { state: "value", value: 5.2 },
        inventory_buffer: { state: "value", seats: 16, airports: "DXB" },
        replacement_rate: { state: "value", percent: 0.8, replacements: 2, rentals: 240 },
        average_preparation: { state: "value", value: 24 },
        installation_time: { state: "value", value: 12 },
        refunds: { state: "value", amount: 150, refunded_bookings: 3 },
        complaints: { state: "not_available", reason: "No complaint record exists yet" },
      },
    });
    for (const name of ["kpi_additional_figures", "kpi_seat_inventory_figures"]) {
      expect(rpc).toHaveBeenCalledWith(name, { p_from: PERIOD.from, p_to: PERIOD.to });
    }
  });

  it("should say No data for the figures that count rentals when the period has none (E1)", async () => {
    const { client } = fakeClient({
      kpi_additional_figures: {
        data: [{ ...BOOKING_ROW, completed_bookings: 0, paid_days: 0, rented_days: 0, replacements: 0, refund_amount: 0, refunded_bookings: 0, installation_jobs: 0, installation_timed: 0, installation_minutes: 0, prepared_bookings: 0, preparation_timed: 0, preparation_minutes: 0 }],
        error: null,
      },
      kpi_seat_inventory_figures: ANSWERS.kpi_seat_inventory_figures,
    });

    const result = await getAdditionalKpis(PERIOD, client);

    expect(result).toMatchObject({
      ok: true,
      kpis: {
        seat_utilisation: { state: "no_data" },
        average_rental_duration: { state: "no_data" },
        replacement_rate: { state: "no_data" },
        average_preparation: { state: "no_data" },
        installation_time: { state: "no_data" },
        refunds: { state: "no_data" },
        inventory_buffer: { state: "value", seats: 16 },
      },
    });
  });

  it("should refuse an invalid period before it reaches the database", async () => {
    const { client, rpc } = fakeClient(ANSWERS);

    expect(await getAdditionalKpis({ from: PERIOD.to, to: PERIOD.from }, client)).toEqual({ ok: false, reason: "invalid_period" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("should report unavailable when one of the reads fails, never a made-up figure", async () => {
    const { client } = fakeClient({ ...ANSWERS, kpi_seat_inventory_figures: { data: null, error: { message: "42501" } } });

    expect(await getAdditionalKpis(PERIOD, client)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("should report unavailable when a call throws", async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error("network")) } as unknown as SupabaseClient<Database>;

    expect(await getAdditionalKpis(PERIOD, client)).toEqual({ ok: false, reason: "unavailable" });
  });
});
