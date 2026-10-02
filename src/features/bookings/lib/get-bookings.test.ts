import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBookings } from "@/features/bookings/lib/get-bookings";
import type { BookingsQuery } from "@/features/bookings/schemas/bookings-query.schema";

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
  for (const method of [
    "select",
    "order",
    "range",
    "ilike",
    "eq",
    "gte",
    "lt",
    "maybeSingle",
  ]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.then = (resolve: (value: Result) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

const baseQuery = {
  sort: "created_at",
  order: "desc",
  page: 1,
  page_size: 10,
} as BookingsQuery;

const AIRPORT_ID = "a0000000-0000-0000-0000-000000000001";

describe("getBookings", () => {
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
        return builder(results.shift() ?? {}, calls);
      },
    });
  });

  it("should return the requested page when it is in range", async () => {
    results.push({ data: [{ id: "a" }], count: 1 });

    const result = await getBookings(baseQuery);

    expect(result).toEqual({ bookings: [{ id: "a" }], total: 1, page: 1 });
    expect(tables).toEqual(["bookings"]);
  });

  it("should load partner, airport, seat and category in one nested select (no N+1)", async () => {
    results.push({ data: [], count: 0 });

    await getBookings(baseQuery);

    const select = calls.find((c) => c.method === "select");
    expect(select?.args[0]).toContain("partner:partners(");
    expect(select?.args[0]).toContain("airport:airports(");
    expect(select?.args[0]).toContain("seat:seats(");
    expect(select?.args[0]).toContain("category:seat_categories(");
    expect(select?.args[1]).toEqual({ count: "exact", head: false });
    expect(tables).toHaveLength(1);
  });

  it("should apply search, status and airport filters", async () => {
    results.push({ data: [], count: 0 });

    await getBookings({
      ...baseQuery,
      q: "BK-1",
      status: "pending",
      airport_id: AIRPORT_ID,
    });

    expect(calls).toContainEqual({
      method: "ilike",
      args: ["booking_number", "%BK-1%"],
    });
    expect(calls).toContainEqual({ method: "eq", args: ["status", "pending"] });
    expect(calls).toContainEqual({
      method: "eq",
      args: ["airport_id", AIRPORT_ID],
    });
  });

  it("should filter pickup_at by the date range in the selected airport timezone", async () => {
    results.push({ data: { timezone: "Asia/Dubai" } });
    results.push({ data: [], count: 0 });

    await getBookings({
      ...baseQuery,
      airport_id: AIRPORT_ID,
      date_from: "2026-09-05",
      date_to: "2026-09-05",
    });

    expect(tables).toEqual(["airports", "bookings"]);
    expect(calls).toContainEqual({
      method: "gte",
      args: ["pickup_at", "2026-09-04T20:00:00.000Z"],
    });
    expect(calls).toContainEqual({
      method: "lt",
      args: ["pickup_at", "2026-09-05T20:00:00.000Z"],
    });
  });

  it("should sort with a unique id tie-breaker and request the page range", async () => {
    results.push({ data: [], count: 0 });

    await getBookings({ ...baseQuery, page: 2, sort: "pickup_at", order: "asc" });

    const orders = calls.filter((c) => c.method === "order");
    expect(orders[0].args).toEqual(["pickup_at", { ascending: true }]);
    expect(orders[1].args).toEqual(["id", { ascending: true }]);
    expect(calls.find((c) => c.method === "range")?.args).toEqual([10, 19]);
  });

  it("should serve the last valid page when the requested page is out of range (PGRST103)", async () => {
    results.push({ error: { code: "PGRST103" } });
    results.push({ count: 25 });
    results.push({ data: [{ id: "z" }], count: 25 });

    const result = await getBookings({ ...baseQuery, page: 9 });

    expect(result).toEqual({ bookings: [{ id: "z" }], total: 25, page: 3 });
  });

  it("should rethrow any other database error", async () => {
    results.push({ error: { code: "XX000" } });

    await expect(getBookings(baseQuery)).rejects.toEqual({ code: "XX000" });
  });
});
