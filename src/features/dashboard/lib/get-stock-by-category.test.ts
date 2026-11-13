import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getStockByCategory } from "@/features/dashboard/lib/get-stock-by-category";

const query = (result: { data: unknown; error: unknown }) => {
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { from, select, eq };
};

describe("getStockByCategory (VI-F11-S06, AC01)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should count only the available seats of each category, with the total of its seats", async () => {
    const q = query({
      data: [
        { name: "Booster", available: [{ count: 8 }], total: [{ count: 20 }] },
        { name: "Convertible", available: [{ count: 16 }], total: [{ count: 30 }] },
      ],
      error: null,
    });
    createClientMock.mockResolvedValue({ from: q.from });

    await expect(getStockByCategory()).resolves.toEqual([
      { label: "Booster", available: 8, total: 20 },
      { label: "Convertible", available: 16, total: 30 },
    ]);
    expect(q.eq).toHaveBeenCalledWith("available.status", "available");
  });

  it("should give 0 for a category whose nested counts are empty", async () => {
    const q = query({ data: [{ name: "Booster", available: [], total: [] }], error: null });
    createClientMock.mockResolvedValue({ from: q.from });

    await expect(getStockByCategory()).resolves.toEqual([{ label: "Booster", available: 0, total: 0 }]);
  });

  it("should give null when the read fails, never zeros", async () => {
    const q = query({ data: null, error: { message: "boom" } });
    createClientMock.mockResolvedValue({ from: q.from });

    await expect(getStockByCategory()).resolves.toBeNull();
  });
});
