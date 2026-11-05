import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { FLIGHT_BOARD_LIMIT } from "./flight-board";
import { getFlightBoard } from "./get-flight-board";

const NOW = new Date("2026-10-24T10:00:00Z");
const DXB = { id: "a1", code: "DXB", name: "Dubai International", timezone: "Asia/Dubai" };
const AUH = { id: "a2", code: "AUH", name: "Abu Dhabi", timezone: "Asia/Dubai" };

const FLIGHT = {
  id: "f1",
  flight_number: "EK 203",
  status: "scheduled",
  scheduled_arrival_at: "2026-10-24T12:30:00Z",
  estimated_arrival_at: "2026-10-24T11:45:00Z",
  actual_arrival_at: null,
  delay_minutes: null,
  last_synced_at: "2026-10-24T09:50:00Z",
  bookings: [{ id: "b1", booking_number: "BK-1", pickup_at: "2026-10-24T12:15:00Z", technician_jobs: [] }],
};

interface Asked {
  eq: [string, unknown][];
  gte: [string, unknown][];
  in: [string, unknown][];
  limit?: number;
}

/** A fake client: `airports` ends at `order()`, `flights` ends at `limit()`; it records what was asked of `flights`. */
function fakeClient(airports: unknown, flights: unknown) {
  const asked: Asked = { eq: [], gte: [], in: [] };
  const flightsQuery = {
    select: () => flightsQuery,
    eq: (column: string, value: unknown) => {
      asked.eq.push([column, value]);
      return flightsQuery;
    },
    in: (column: string, value: unknown) => {
      asked.in.push([column, value]);
      return flightsQuery;
    },
    gte: (column: string, value: unknown) => {
      asked.gte.push([column, value]);
      return flightsQuery;
    },
    order: () => flightsQuery,
    limit: async (value: number) => {
      asked.limit = value;
      return flights;
    },
  };
  const airportsQuery = { select: () => airportsQuery, order: async () => airports };

  createClientMock.mockResolvedValue({ from: (table: string) => (table === "airports" ? airportsQuery : flightsQuery) });

  return asked;
}

describe("getFlightBoard", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should open the first airport and ask for the flights from the start of today at that airport", async () => {
    const asked = fakeClient({ data: [DXB, AUH], error: null }, { data: [FLIGHT], error: null });

    const board = await getFlightBoard({}, NOW);

    expect(board.airport?.code).toBe("DXB");
    expect(asked.eq).toContainEqual(["airport_id", "a1"]);
    expect(asked.gte[0][0]).toBe("scheduled_arrival_at");
    expect(String(asked.gte[0][1])).toContain("2026-10-23T20:00:00");
    expect(asked.limit).toBe(FLIGHT_BOARD_LIMIT);
    expect(board.heading).toBe("DXB · Dubai International · 24 Oct 2026 · Asia/Dubai (GST, UTC+4)");
    expect(board.rows).toHaveLength(1);
    expect(board.alerts[0].title).toBe("ARRIVING 45 MINUTES EARLY");
    expect(board.last_sync_label).toBe("Last sync 13:50 GST");
  });

  it("should list only the bookings that are still active, never a cancelled or finished one", async () => {
    const asked = fakeClient({ data: [DXB], error: null }, { data: [FLIGHT], error: null });

    await getFlightBoard({}, NOW);

    expect(asked.in).toHaveLength(1);
    expect(asked.in[0][0]).toBe("bookings.status");
    expect(asked.in[0][1]).toContain("confirmed");
    expect(asked.in[0][1]).not.toContain("cancelled");
    expect(asked.in[0][1]).not.toContain("completed");
  });

  it("should read the airport and the status chosen in the address", async () => {
    const asked = fakeClient({ data: [DXB, AUH], error: null }, { data: [], error: null });

    const board = await getFlightBoard({ airport_id: "a2", status: "landed" }, NOW);

    expect(board.airport?.code).toBe("AUH");
    expect(asked.eq).toContainEqual(["airport_id", "a2"]);
    expect(asked.eq).toContainEqual(["status", "landed"]);
  });

  it("should fall back to the first airport when the airport of the address is not visible", async () => {
    fakeClient({ data: [DXB], error: null }, { data: [], error: null });

    expect((await getFlightBoard({ airport_id: "someone-elses" }, NOW)).airport?.code).toBe("DXB");
  });

  it("should give an empty board and read no flight when the viewer sees no airport", async () => {
    const asked = fakeClient({ data: [], error: null }, { data: [FLIGHT], error: null });

    const board = await getFlightBoard({}, NOW);

    expect(board).toMatchObject({ airport: null, heading: null, rows: [], alerts: [] });
    expect(asked.limit).toBeUndefined();
  });

  it("should say never synced when no flight of the list ever synced", async () => {
    fakeClient({ data: [DXB], error: null }, { data: [{ ...FLIGHT, last_synced_at: null }], error: null });

    expect((await getFlightBoard({}, NOW)).last_sync_label).toBe("Never synced");
  });

  it("should say the list is cut when it holds as many flights as the board reads", async () => {
    fakeClient({ data: [DXB], error: null }, { data: Array.from({ length: FLIGHT_BOARD_LIMIT }, () => FLIGHT), error: null });

    expect((await getFlightBoard({}, NOW)).truncated).toBe(true);
  });

  it("should throw when the flights cannot be read, so the page shows its error state and not an empty board", async () => {
    fakeClient({ data: [DXB], error: null }, { data: null, error: new Error("boom") });

    await expect(getFlightBoard({}, NOW)).rejects.toThrow("boom");
  });

  it("should throw when the airports cannot be read", async () => {
    fakeClient({ data: null, error: new Error("no airports") }, { data: [], error: null });

    await expect(getFlightBoard({}, NOW)).rejects.toThrow("no airports");
  });
});
