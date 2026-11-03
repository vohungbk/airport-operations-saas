import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";

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
  status: "pending",
  pickup_at: "2026-10-24T11:15:00Z",
  partner: { name: "Emirates Rent A Car" },
  airport: { code: "DXB", timezone: "Asia/Dubai" },
  seat: { serial_number: "SEAT-0001", status: "available" },
  category: { name: "Convertible" },
  flight: {
    flight_number: "EK 203",
    scheduled_arrival_at: "2026-10-24T11:00:00Z",
    estimated_arrival_at: "2026-10-24T11:50:00Z",
    actual_arrival_at: null,
    delay_minutes: null,
  },
  priority: "urgent",
  step_since: "2026-10-23T09:50:00Z",
};

/** 45 minutes after the deadline of the next step (24 h before the pickup), 2 h 10 min after the step began. */
const NOW = new Date("2026-10-23T12:00:00Z");

describe("getWorkflowBoard", () => {
  let calls: Call[];
  let results: Result[];
  let tables: string[];

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
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

    expect(board.columns.map((column) => column.status)).toEqual(BOOKING_BOARD_STEPS);
    expect(tables).toEqual(BOOKING_BOARD_STEPS.map(() => "bookings"));
    expect(statusesQueried()).toEqual(BOOKING_BOARD_STEPS);
  });

  it("should put each booking in its step with its card and add up the bookings in view", async () => {
    results = [
      { data: [ROW], count: 1 },
      ...BOOKING_BOARD_STEPS.slice(1, -1).map(() => ({ data: [], count: 0 })),
      { data: [{ ...ROW, id: "booking-2" }], count: 12 },
    ];

    const board = await getWorkflowBoard({});

    expect(board.columns[0].cards).toEqual([
      {
        id: "booking-1",
        booking_number: "BK-2026-000123",
        status: "pending",
        summary: "Emirates Rent A Car · EK 203 · DXB",
        seat_status: "available",
        partner_name: "Emirates Rent A Car",
        flight_number: "EK 203",
        seat_label: "SEAT-0001 · Convertible",
        pickup_label: "24 Oct, 15:15 GST · DXB",
        priority: "urgent",
        flight_alert: { kind: "delayed", minutes: 50, label: "Delayed 50 min" },
        overdue_label: "Overdue by 45 min",
        time_in_step_label: "In step 2 h 10 min",
      },
    ]);
    expect(board.columns.at(-1)?.total).toBe(12);
    expect(board.total).toBe(13);
  });

  it("should apply the partner, the search and the card limit to every column", async () => {
    await getWorkflowBoard({ partner_id: PARTNER_ID, q: "50%" });

    expect(calls.filter((call) => call.method === "eq" && call.args[0] === "partner_id")).toHaveLength(13);
    expect(
      calls.filter((call) => call.method === "ilike").every((call) => call.args[1] === "%50\\%%"),
    ).toBe(true);
    expect(calls.filter((call) => call.method === "limit").every((call) => call.args[0] === BOARD_COLUMN_CARD_LIMIT)).toBe(true);
  });

  it("should show only the time of the pickup when the board is read for one day", async () => {
    results = [{ data: { timezone: "Asia/Dubai" } }, { data: [ROW], count: 1 }];

    const board = await getWorkflowBoard({ airport_id: "a0000000-0000-0000-0000-000000000001", date: "2026-10-24" });

    expect(board.columns[0].cards[0].pickup_label).toBe("15:15 GST · DXB");
    expect(board.time_zone).toBe("Asia/Dubai");
  });

  it("should leave the timezone out when the board is not read for one day at one airport", async () => {
    const board = await getWorkflowBoard({});

    expect(board.time_zone).toBeNull();
  });

  it("should apply the flight alert and the priority to every column", async () => {
    await getWorkflowBoard({ flight_alert: "early", priority: "high" });

    expect(calls.filter((call) => call.method === "eq" && call.args[0] === "board_flight_alert")).toHaveLength(13);
    expect(
      calls
        .filter((call) => call.method === "eq" && call.args[0] === "board_priority")
        .every((call) => call.args[1] === "high"),
    ).toBe(true);
  });

  it("should not filter by flight alert or priority when none is set", async () => {
    await getWorkflowBoard({});

    expect(calls.some((call) => call.method === "eq" && String(call.args[0]).startsWith("board_"))).toBe(false);
  });

  it("should treat a priority it does not know as normal and give no marks to a booking that is on time", async () => {
    results = [
      {
        data: [
          {
            ...ROW,
            priority: "unexpected",
            step_since: null,
            pickup_at: "2026-10-30T11:15:00Z",
            flight: {
              ...ROW.flight,
              scheduled_arrival_at: "2026-10-30T11:00:00Z",
              estimated_arrival_at: "2026-10-30T11:05:00Z",
            },
          },
        ],
        count: 1,
      },
    ];

    const board = await getWorkflowBoard({});

    expect(board.columns[0].cards[0]).toMatchObject({
      priority: "normal",
      flight_alert: null,
      overdue_label: null,
      time_in_step_label: null,
    });
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

    expect(board.columns[0].cards[0]).toMatchObject({
      seat_label: null,
      seat_status: null,
      flight_number: null,
      summary: "Emirates Rent A Car · DXB",
    });
  });

  it("should throw the database error so the error boundary shows its retry", async () => {
    results = [{ data: null, error: { code: "XX000" } }];

    await expect(getWorkflowBoard({})).rejects.toEqual({ code: "XX000" });
  });
});
