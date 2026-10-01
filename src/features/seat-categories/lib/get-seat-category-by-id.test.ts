import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

import { getSeatCategoryById } from "@/features/seat-categories/lib/get-seat-category-by-id";

describe("getSeatCategoryById", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("should return null without querying when the id is not a uuid", async () => {
    await expect(getSeatCategoryById("not-a-uuid")).resolves.toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });
});
