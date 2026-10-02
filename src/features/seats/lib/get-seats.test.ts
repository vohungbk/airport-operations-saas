import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSeats } from "@/features/seats/lib/get-seats";
import type { SeatsQuery } from "@/features/seats/schemas/seats-query.schema";

interface Result {
  data?: unknown[] | null;
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
  for (const method of ["select", "order", "range", "or", "eq"]) {
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
} as SeatsQuery;

const AIRPORT_ID = "a0000000-0000-0000-0000-000000000001";
const CATEGORY_ID = "c0000000-0000-0000-0000-000000000002";

describe("getSeats", () => {
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

    const result = await getSeats(baseQuery);

    expect(result).toEqual({ seats: [{ id: "a" }], total: 1, page: 1 });
    expect(tables).toEqual(["seats"]);
  });

  it("should load category and airport in one nested select (no N+1)", async () => {
    results.push({ data: [], count: 0 });

    await getSeats(baseQuery);

    const select = calls.find((c) => c.method === "select");
    expect(select?.args[0]).toContain("category:seat_categories(id, name)");
    expect(select?.args[0]).toContain("airport:airports(id, code, name)");
    expect(select?.args[1]).toEqual({ count: "exact" });
    expect(tables).toHaveLength(1);
  });

  it("should combine airport, category and status filters with AND", async () => {
    results.push({ data: [], count: 0 });

    await getSeats({
      ...baseQuery,
      airport_id: AIRPORT_ID,
      category_id: CATEGORY_ID,
      status: "quarantine",
    });

    const eqs = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqs).toEqual([
      ["airport_id", AIRPORT_ID],
      ["category_id", CATEGORY_ID],
      ["status", "quarantine"],
    ]);
  });

  it("should apply no filters when none are given", async () => {
    results.push({ data: [], count: 0 });

    await getSeats(baseQuery);

    expect(calls.some((c) => c.method === "eq" || c.method === "or")).toBe(false);
  });

  it("should search serial_number and public_token with an OR filter", async () => {
    results.push({ data: [], count: 0 });

    await getSeats({ ...baseQuery, q: "SEAT-00" });

    const or = calls.find((c) => c.method === "or");
    expect(or?.args[0]).toContain("serial_number.ilike.");
    expect(or?.args[0]).toContain("public_token.ilike.");
  });

  it("should add id as a tie-breaker order after the sort column", async () => {
    results.push({ data: [], count: 0 });

    await getSeats({ ...baseQuery, sort: "serial_number", order: "asc" });

    const orders = calls.filter((c) => c.method === "order");
    expect(orders.map((c) => c.args[0])).toEqual(["serial_number", "id"]);
    expect(orders[0].args[1]).toEqual({ ascending: true });
  });

  it("should serve the last valid page when the requested page is out of range (PGRST103)", async () => {
    results.push(
      { data: null, count: null, error: { code: "PGRST103" } },
      { count: 25 },
      { data: [{ id: "z" }], count: 25 },
    );

    const result = await getSeats({ ...baseQuery, page: 999 });

    expect(result).toEqual({ seats: [{ id: "z" }], total: 25, page: 3 });
    const ranges = calls.filter((c) => c.method === "range");
    expect(ranges.at(-1)?.args).toEqual([20, 29]);
  });

  it("should keep the active filters when counting for the last-page fallback", async () => {
    results.push(
      { error: { code: "PGRST103" } },
      { count: 5 },
      { data: [], count: 5 },
    );

    await getSeats({ ...baseQuery, page: 9, status: "retired" });

    const statusFilters = calls.filter(
      (c) => c.method === "eq" && c.args[0] === "status",
    );
    expect(statusFilters).toHaveLength(3);
  });

  it("should fall back to page 1 when no rows match and the page is out of range", async () => {
    results.push(
      { error: { code: "PGRST103" } },
      { count: 0 },
      { data: [], count: 0 },
    );

    const result = await getSeats({ ...baseQuery, page: 5 });

    expect(result).toEqual({ seats: [], total: 0, page: 1 });
  });

  it("should throw PGRST103 unchanged when page 1 itself fails", async () => {
    results.push({ error: { code: "PGRST103" } });

    await expect(getSeats(baseQuery)).rejects.toEqual({ code: "PGRST103" });
  });

  it("should throw other database errors unchanged", async () => {
    results.push({ error: { code: "42501" } });

    await expect(getSeats(baseQuery)).rejects.toEqual({ code: "42501" });
  });
});
