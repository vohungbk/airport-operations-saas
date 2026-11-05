import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.types";

import type { FlightSnapshot, FlightSourceAdapter } from "./provider/flight-source";
import { refreshFlights } from "./refresh-flights";

const NOW = new Date("2026-10-24T10:00:00.000Z");
const HOUR = 60 * 60_000;
const MINUTE = 60_000;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();

/** A linked flight that lands in 2 hours, last synced 10 minutes ago: due (5 minute window). */
function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    flight_number: `EK${id}`,
    status: "scheduled",
    scheduled_arrival_at: at(2 * HOUR),
    estimated_arrival_at: at(2 * HOUR),
    actual_arrival_at: null,
    terminal: "3",
    delay_minutes: null,
    last_synced_at: at(-10 * MINUTE),
    bookings: [{ id: `b-${id}` }],
    ...overrides,
  };
}

function snapshot(flight_number: string, overrides: Partial<FlightSnapshot> = {}): FlightSnapshot {
  return {
    flight_number,
    status: "scheduled",
    scheduled_arrival_at: at(2 * HOUR),
    estimated_arrival_at: at(2 * HOUR),
    actual_arrival_at: null,
    terminal: "3",
    delay_minutes: null,
    ...overrides,
  };
}

interface RpcCall {
  fn: string;
  args: {
    p_flight_id: string;
    p_values: Record<string, unknown>;
    p_changes: { field: string }[];
    p_source: string;
    p_expected_synced_at?: string;
  };
}

/** A fake client: the select answers `rows` (or fails), `rpc` records its calls and fails for `failRpcFor`. */
function fakeClient(
  rows: unknown[],
  options: { selectError?: boolean; failRpcFor?: string[]; skipRpcFor?: string[] } = {},
) {
  const calls: RpcCall[] = [];

  const client = {
    from: () => ({
      select: () => {
        const query = {
          not: () => query,
          then: (resolve: (value: unknown) => void) =>
            resolve(options.selectError ? { data: null, error: new Error("db") } : { data: rows, error: null }),
        };
        return query;
      },
    }),
    rpc: async (fn: string, args: RpcCall["args"]) => {
      calls.push({ fn, args });
      return {
        data: !options.skipRpcFor?.includes(args.p_flight_id),
        error: options.failRpcFor?.includes(args.p_flight_id) ? new Error("db") : null,
      };
    },
  };

  return { client: client as unknown as SupabaseClient<Database>, calls };
}

const adapterOf = (
  fetchFlight: FlightSourceAdapter["fetchFlight"],
  source: FlightSourceAdapter["source"] = "provider",
): (() => FlightSourceAdapter) => () => ({ source, fetchFlight });

describe("refreshFlights", () => {
  it("should store the new data and keep what changed with the source when a due flight changed (VI-F02-S03-AC01, AC02)", async () => {
    const { client, calls } = fakeClient([row("1")]);
    const earlier = at(2 * HOUR - 45 * MINUTE);
    const fetchFlight = vi.fn(async (number: string) => snapshot(number, { estimated_arrival_at: earlier }));

    const summary = await refreshFlights(client, { now: NOW, source: adapterOf(fetchFlight) });

    expect(summary).toEqual({ checked: 1, refreshed: 1, changed: 1, skipped: 0, not_found: 0, failed: 0 });
    expect(fetchFlight).toHaveBeenCalledWith("EK1");
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("apply_flight_refresh");
    expect(calls[0].args.p_flight_id).toBe("1");
    expect(calls[0].args.p_source).toBe("provider");
    expect(calls[0].args.p_values).toMatchObject({ estimated_arrival_at: earlier, provider: "provider" });
    expect(calls[0].args.p_changes.map((change) => change.field)).toEqual(["estimated_arrival_at"]);
  });

  it("should name the system as the source when the data comes from the simulator", async () => {
    const { client, calls } = fakeClient([row("1")]);
    const fetchFlight = async (number: string) => snapshot(number, { terminal: "1" });

    await refreshFlights(client, { now: NOW, source: adapterOf(fetchFlight, "simulator") });

    expect(calls[0].args.p_source).toBe("system");
    expect(calls[0].args.p_values.provider).toBe("simulator");
  });

  it("should store the sync time but write no history when the data did not change", async () => {
    const { client, calls } = fakeClient([row("1")]);

    const summary = await refreshFlights(client, {
      now: NOW,
      source: adapterOf(async (number) => snapshot(number)),
    });

    expect(summary).toMatchObject({ refreshed: 1, changed: 0 });
    expect(calls[0].args.p_changes).toEqual([]);
  });

  it("should not ask the source for a flight that is not due yet", async () => {
    const { client, calls } = fakeClient([row("1", { last_synced_at: at(-2 * MINUTE) })]);
    const fetchFlight = vi.fn();

    const summary = await refreshFlights(client, { now: NOW, source: adapterOf(fetchFlight) });

    expect(summary.checked).toBe(0);
    expect(fetchFlight).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("should not ask the source again for a flight more than 24 hours away that has synced", async () => {
    const { client } = fakeClient([row("1", { scheduled_arrival_at: at(48 * HOUR) })]);
    const fetchFlight = vi.fn();

    const summary = await refreshFlights(client, { now: NOW, source: adapterOf(fetchFlight) });

    expect(summary.checked).toBe(0);
    expect(fetchFlight).not.toHaveBeenCalled();
  });

  it("should keep the stored data and go on with the other flights when the source fails for one (VI-F02-S03-AC03)", async () => {
    const { client, calls } = fakeClient([row("1"), row("2")]);
    const fetchFlight = async (number: string) => {
      if (number === "EK1") throw new Error("timeout");
      return snapshot(number, { terminal: "2" });
    };

    const summary = await refreshFlights(client, { now: NOW, source: adapterOf(fetchFlight) });

    expect(summary).toEqual({ checked: 2, refreshed: 1, changed: 1, skipped: 0, not_found: 0, failed: 1 });
    expect(calls.map((call) => call.args.p_flight_id)).toEqual(["2"]);
  });

  it("should send the sync time it read, so a run that was overtaken writes nothing", async () => {
    const synced = at(-10 * MINUTE);
    const { client, calls } = fakeClient([row("1", { last_synced_at: synced })]);

    await refreshFlights(client, {
      now: NOW,
      source: adapterOf(async (number) => snapshot(number, { terminal: "2" })),
    });

    expect(calls[0].args.p_expected_synced_at).toBe(synced);
  });

  it("should not send an expected sync time for a flight that never synced", async () => {
    const { client, calls } = fakeClient([row("1", { last_synced_at: null })]);

    await refreshFlights(client, { now: NOW, source: adapterOf(async (number) => snapshot(number)) });

    expect(calls[0].args).not.toHaveProperty("p_expected_synced_at");
  });

  it("should count a flight that another run refreshed first as skipped, not as refreshed", async () => {
    const { client } = fakeClient([row("1"), row("2")], { skipRpcFor: ["1"] });

    const summary = await refreshFlights(client, {
      now: NOW,
      source: adapterOf(async (number) => snapshot(number, { terminal: "2" })),
    });

    expect(summary).toMatchObject({ checked: 2, refreshed: 1, changed: 1, skipped: 1, failed: 0 });
  });

  it("should count a failed write as failed and keep going", async () => {
    const { client } = fakeClient([row("1"), row("2")], { failRpcFor: ["1"] });

    const summary = await refreshFlights(client, {
      now: NOW,
      source: adapterOf(async (number) => snapshot(number, { terminal: "2" })),
    });

    expect(summary).toMatchObject({ checked: 2, refreshed: 1, failed: 1 });
  });

  it("should keep the stored data when the source no longer knows the flight", async () => {
    const { client, calls } = fakeClient([row("1")]);

    const summary = await refreshFlights(client, { now: NOW, source: adapterOf(async () => null) });

    expect(summary).toMatchObject({ checked: 1, refreshed: 0, not_found: 1 });
    expect(calls).toEqual([]);
  });

  it("should ask every due flight, more than one batch of them", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => row(String(index + 1)));
    const { client, calls } = fakeClient(rows);

    const summary = await refreshFlights(client, {
      now: NOW,
      source: adapterOf(async (number) => snapshot(number, { terminal: "2" })),
    });

    expect(summary).toMatchObject({ checked: 12, refreshed: 12, changed: 12 });
    expect(calls).toHaveLength(12);
  });

  it("should do nothing when no flight is linked", async () => {
    const { client } = fakeClient([]);

    const summary = await refreshFlights(client, { now: NOW, source: adapterOf(vi.fn()) });

    expect(summary).toEqual({ checked: 0, refreshed: 0, changed: 0, skipped: 0, not_found: 0, failed: 0 });
  });

  it("should throw when the flights cannot be read, so the job reports the failure", async () => {
    const { client } = fakeClient([], { selectError: true });

    await expect(refreshFlights(client, { now: NOW, source: adapterOf(vi.fn()) })).rejects.toThrow();
  });
});
