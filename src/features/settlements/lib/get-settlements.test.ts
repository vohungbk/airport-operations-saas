import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { SETTLEMENTS_SELECT, getSettlements } from "@/features/settlements/lib/get-settlements";
import { SETTLEMENTS_PAGE_SIZE } from "@/features/settlements/schemas/settlements-query.schema";

/** A query builder that records its calls and resolves, like PostgREST's, when awaited. */
function builder(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const calls: Record<string, unknown[][]> = {};
  const proxy: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null, count: null, ...result }),
  };

  for (const name of ["eq", "order", "range"]) {
    calls[name] = [];
    proxy[name] = (...args: unknown[]) => {
      calls[name].push(args);
      return proxy;
    };
  }

  return { proxy, calls };
}

function mockClient(...builders: ReturnType<typeof builder>[]) {
  const select = vi.fn();
  builders.forEach((item) => select.mockReturnValueOnce(item.proxy));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { from, select };
}

describe("getSettlements", () => {
  beforeEach(() => createClientMock.mockReset());

  it("should read one page with the partner in one query, newest month first (AC03)", async () => {
    const q = builder({ data: [{ id: "s-1" }], count: 1 });
    const client = mockClient(q);

    const result = await getSettlements({ page: 1 });

    expect(client.from).toHaveBeenCalledWith("settlements");
    expect(client.select).toHaveBeenCalledWith(SETTLEMENTS_SELECT, { count: "exact" });
    expect(SETTLEMENTS_SELECT).toContain("settlement_number");
    expect(SETTLEMENTS_SELECT).toContain("partner:partners(name, code)");
    expect(q.calls.order[0]).toEqual(["period_start", { ascending: false }]);
    expect(q.calls.range[0]).toEqual([0, SETTLEMENTS_PAGE_SIZE - 1]);
    expect(result).toEqual({ settlements: [{ id: "s-1" }], total: 1, page: 1 });
  });

  it("should narrow by partner, period month and status when they are asked for", async () => {
    const q = builder({ data: [], count: 0 });
    mockClient(q);

    await getSettlements({ partner_id: "p-1", month: "2026-10", status: "paid", page: 3 });

    expect(q.calls.eq).toEqual([
      ["partner_id", "p-1"],
      ["period_start", "2026-10-01"],
      ["status", "paid"],
    ]);
    expect(q.calls.range[0]).toEqual([2 * SETTLEMENTS_PAGE_SIZE, 3 * SETTLEMENTS_PAGE_SIZE - 1]);
  });

  it("should return an empty page when RLS hides every row", async () => {
    mockClient(builder({ data: null, count: null }));

    await expect(getSettlements({ page: 1 })).resolves.toEqual({ settlements: [], total: 0, page: 1 });
  });

  it("should serve the last page when the page asked for is past the last row", async () => {
    const past = builder({ error: { code: "PGRST103", message: "range" } });
    const count = builder({ count: 11 });
    const last = builder({ data: [{ id: "s-11" }], count: 11 });
    mockClient(past, count, last);

    const result = await getSettlements({ page: 9 });

    expect(last.calls.range[0]).toEqual([SETTLEMENTS_PAGE_SIZE, 2 * SETTLEMENTS_PAGE_SIZE - 1]);
    expect(result).toEqual({ settlements: [{ id: "s-11" }], total: 11, page: 2 });
  });

  it("should throw when the query fails", async () => {
    mockClient(builder({ error: new Error("db down") }));

    await expect(getSettlements({ page: 1 })).rejects.toThrow("db down");
  });
});
