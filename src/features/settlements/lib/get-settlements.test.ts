import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  SETTLEMENTS_LIMIT,
  SETTLEMENTS_SELECT,
  getSettlements,
} from "@/features/settlements/lib/get-settlements";

function mockQuery(result: { data: unknown; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const order = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { from, select, order, limit };
}

describe("getSettlements", () => {
  beforeEach(() => createClientMock.mockReset());

  it("should read the settlements with their partner in one query, newest month first (AC03)", async () => {
    const q = mockQuery({ data: [], error: null });

    await getSettlements();

    expect(q.from).toHaveBeenCalledTimes(1);
    expect(q.from).toHaveBeenCalledWith("settlements");
    expect(q.select).toHaveBeenCalledWith(SETTLEMENTS_SELECT);
    expect(SETTLEMENTS_SELECT).toContain("partner:partners(name, code)");
    expect(SETTLEMENTS_SELECT).toContain("status_changed_at");
    expect(q.order).toHaveBeenCalledWith("period_start", { ascending: false });
    expect(q.limit).toHaveBeenCalledWith(SETTLEMENTS_LIMIT);
  });

  it("should return the rows, and an empty list when RLS hides them all", async () => {
    mockQuery({ data: [{ id: "s-1" }], error: null });
    await expect(getSettlements()).resolves.toEqual([{ id: "s-1" }]);

    mockQuery({ data: null, error: null });
    await expect(getSettlements()).resolves.toEqual([]);
  });

  it("should throw when the query fails", async () => {
    mockQuery({ data: null, error: new Error("db down") });

    await expect(getSettlements()).rejects.toThrow("db down");
  });
});
