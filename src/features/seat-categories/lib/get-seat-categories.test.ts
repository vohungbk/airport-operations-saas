import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSeatCategories } from "@/features/seat-categories/lib/get-seat-categories";
import type { SeatCategoriesQuery } from "@/features/seat-categories/schemas/seat-categories-query.schema";

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
  sort: "name",
  order: "asc",
  page: 1,
  page_size: 10,
} as SeatCategoriesQuery;

describe("getSeatCategories", () => {
  let calls: Call[];
  let results: Result[];

  beforeEach(() => {
    calls = [];
    results = [];
    createClientMock.mockReset();
    createClientMock.mockResolvedValue({
      from: () => builder(results.shift() ?? {}, calls),
    });
  });

  it("should add id as a tie-breaker order after the sort column", async () => {
    results.push({ data: [], count: 0 });

    await getSeatCategories({ ...baseQuery, sort: "safety_standard" });

    const orders = calls.filter((c) => c.method === "order");
    expect(orders.map((c) => c.args[0])).toEqual(["safety_standard", "id"]);
  });

  it("should return the requested page when it is in range", async () => {
    results.push({ data: [{ id: "a" }], count: 1 });

    const result = await getSeatCategories(baseQuery);

    expect(result).toEqual({
      seatCategories: [{ id: "a" }],
      total: 1,
      page: 1,
    });
  });

  it("should serve the last valid page when the requested page is out of range", async () => {
    results.push(
      { data: null, count: null, error: { code: "PGRST103" } },
      { count: 25 },
      { data: [{ id: "z" }], count: 25 },
    );

    const result = await getSeatCategories({ ...baseQuery, page: 999 });

    expect(result).toEqual({
      seatCategories: [{ id: "z" }],
      total: 25,
      page: 3,
    });
    const ranges = calls.filter((c) => c.method === "range");
    expect(ranges.at(-1)?.args).toEqual([20, 29]);
  });

  it("should fall back to page 1 when no rows match and the page is out of range", async () => {
    results.push(
      { error: { code: "PGRST103" } },
      { count: 0 },
      { data: [], count: 0 },
    );

    const result = await getSeatCategories({ ...baseQuery, page: 5 });

    expect(result).toEqual({ seatCategories: [], total: 0, page: 1 });
  });

  it("should throw other database errors unchanged", async () => {
    results.push({ error: { code: "42501" } });

    await expect(getSeatCategories(baseQuery)).rejects.toEqual({
      code: "42501",
    });
  });
});
