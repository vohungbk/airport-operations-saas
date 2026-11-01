import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BOARD_COLUMN_CARD_LIMIT,
  getWorkflowBoard,
} from "@/features/workflow-board/lib/get-workflow-board";

interface Result {
  data?: unknown;
  count?: number | null;
  error?: { code: string } | null;
}

interface Call {
  method: string;
  args: unknown[];
}

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

/** Chainable, awaitable stand-in for a PostgREST query builder. */
function builder(result: Result, calls: Call[]) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "order", "limit", "ilike", "eq", "gte", "lt", "maybeSingle"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

const PARTNER_ID = "b0000000-0000-0000-0000-000000000001";

const ROW = {
  id: "booking-1",
  booking_number: "BK-2026-000123",
  pickup_at: "2026-10-24T11:15:00Z",
  partner: { name: "Emirates Rent A Car" },
  airport: { code: "DXB", timezone: "Asia/Dubai" },
  seat: { serial_number: "SEAT-0001" },
  category: { name: "Convertible" },
  flight: { flight_number: "EK 203" },
};

describe("getWorkflowBoard", () => {
  let calls: Call[];
  let results: Result[];
  let tables: string[];

  beforeEach(() => {
    calls = [];
    results = [];
    tables = [];
    createClientMock.mockReset();
    createClientMock.mockResolvedValue({
      from: (table: string) => {
        tables.push(table);
        return builder(results.shift() ?? { data: [], count: 0 }, calls);
      },
    });
  });

  const statusesQueried = () =>
    calls.filter((call) => call.method === "eq" && call.args[0] === "status").map((call) => call.args[1]);

  it("should read one column per step of the booking path with one query each", async () => {
    const board = await getWorkflowBoard({});

    expect(board.columns.map((column) => column.status)).toEqual([
      "pending",
      "confirmed",
      "assigned",
      "in_progress",
      "completed",
    ]);
    expect(tables).toEqual(["bookings", "bookings", "bookings", "bookings", "bookings"]);
    expect(statusesQueried()).toEqual(["pending", "confirmed", "assigned", "in_progress", "completed"]);
  });

  it("should put each booking in its step with its card and add up the bookings in view", async () => {
    results = [
      { data: [ROW], count: 1 },
      { data: [], count: 0 },
      { data: [], count: 0 },
      { data: [], count: 0 },
      { data: [{ ...ROW, id: "booking-2" }], count: 12 },
    ];

    const board = await getWorkflowBoard({});

    expect(board.columns[0].cards).toEqual([
      {
        id: "booking-1",
        booking_number: "BK-2026-000123",
        partner_name: "Emirates Rent A Car",
        flight_number: "EK 203",
        seat_label: "SEAT-0001 · Convertible",
        pickup_label: "24 Oct 2026, 15:15 · DXB",
      },
    ]);
    expect(board.columns[4].total).toBe(12);
    expect(board.total).toBe(13);
  });

  it("should apply the partner, the search and the card limit to every column", async () => {
    await getWorkflowBoard({ partner_id: PARTNER_ID, q: "50%" });

    expect(calls.filter((call) => call.method === "eq" && call.args[0] === "partner_id")).toHaveLength(5);
    expect(
      calls.filter((call) => call.method === "ilike").every((call) => call.args[1] === "%50\\%%"),
    ).toBe(true);
    expect(calls.filter((call) => call.method === "limit").every((call) => call.args[0] === BOARD_COLUMN_CARD_LIMIT)).toBe(true);
  });

  it("should read a day as a calendar day at the airport when an airport is selected", async () => {
    results = [{ data: { timezone: "Asia/Dubai" } }];

    await getWorkflowBoard({ airport_id: "a0000000-0000-0000-0000-000000000001", date: "2026-10-24" });

    expect(tables[0]).toBe("airports");
    const bounds = calls.filter((call) => call.method === "gte" || call.method === "lt");
    expect(bounds[0].args).toEqual(["pickup_at", "2026-10-23T20:00:00.000Z"]);
    expect(bounds[1].args).toEqual(["pickup_at", "2026-10-24T20:00:00.000Z"]);
  });

  it("should leave a booking with no seat or flight without those lines instead of failing", async () => {
    results = [{ data: [{ ...ROW, seat: null, category: null, flight: null }], count: 1 }];

    const board = await getWorkflowBoard({});

    expect(board.columns[0].cards[0]).toMatchObject({ seat_label: null, flight_number: null });
  });

  it("should throw the database error so the error boundary shows its retry", async () => {
    results = [{ data: null, error: { code: "XX000" } }];

    await expect(getWorkflowBoard({})).rejects.toEqual({ code: "XX000" });
  });
});
