import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { FLIGHT_UPDATES_LIMIT, getFlightUpdates } from "./get-flight-updates";

const FLIGHT_ID = "d5300000-0000-0000-0000-000000000001";

const ROWS = [
  {
    id: "u-2",
    source: "provider",
    occurred_at: "2026-10-24T10:02:00.000Z",
    changes: [{ field: "estimated_arrival_at", from: null, to: "2026-10-24T11:45:00Z" }],
  },
  {
    id: "u-1",
    source: "system",
    occurred_at: "2026-10-24T08:10:00.000Z",
    changes: [{ field: "terminal", from: null, to: "3" }],
  },
];

/** A fake client for `from().select().eq().order().order().limit()`; it records what was asked. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const asked: { table?: string; flight?: unknown; orders: unknown[][]; limit?: number } = { orders: [] };
  const query = {
    select: () => query,
    eq: (_column: string, value: unknown) => {
      asked.flight = value;
      return query;
    },
    order: (...args: unknown[]) => {
      asked.orders.push(args);
      return query;
    },
    limit: async (value: number) => {
      asked.limit = value;
      return result;
    },
  };

  createClientMock.mockResolvedValue({
    from: (table: string) => {
      asked.table = table;
      return query;
    },
  });

  return asked;
}

describe("getFlightUpdates (VI-F02-T01)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should read the history of the flight, newest first (AC01)", async () => {
    const asked = fakeClient({ data: ROWS, error: null });

    const result = await getFlightUpdates(FLIGHT_ID);

    expect(result?.error).toBe(false);
    expect(result?.items.map((item) => item.id)).toEqual(["u-2", "u-1"]);
    expect(asked.table).toBe("flight_updates");
    expect(asked.flight).toBe(FLIGHT_ID);
    expect(asked.orders[0]).toEqual(["occurred_at", { ascending: false }]);
    expect(asked.limit).toBe(FLIGHT_UPDATES_LIMIT);
  });

  it("should answer an empty list, with no error, when the flight has no history (AC04)", async () => {
    fakeClient({ data: [], error: null });

    expect(await getFlightUpdates(FLIGHT_ID)).toEqual({ items: [], error: false });
  });

  it("should answer an error and no entries, and not throw, when the history cannot be read (AC05)", async () => {
    fakeClient({ data: null, error: { message: "permission denied for table flight_updates" } });

    expect(await getFlightUpdates(FLIGHT_ID)).toEqual({ items: [], error: true });
  });

  it("should answer an error, and not throw, when the database client cannot be made", async () => {
    createClientMock.mockRejectedValue(new Error("Invalid configuration"));

    expect(await getFlightUpdates(FLIGHT_ID)).toEqual({ items: [], error: true });
  });

  it("should leave out a stored row that is not of the expected shape", async () => {
    fakeClient({ data: [ROWS[0], { id: "u-bad", source: "guess", occurred_at: "x", changes: [] }], error: null });

    const result = await getFlightUpdates(FLIGHT_ID);

    expect(result?.items.map((item) => item.id)).toEqual(["u-2"]);
  });

  it("should not ask the database when the booking has no linked flight", async () => {
    expect(await getFlightUpdates(null)).toBeNull();
    expect(await getFlightUpdates(undefined)).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should not ask the database for an id that is not an id", async () => {
    expect(await getFlightUpdates("1 or 1=1")).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
