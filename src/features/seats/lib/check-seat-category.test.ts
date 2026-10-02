import { describe, expect, it, vi } from "vitest";

import { checkSeatCategory } from "@/features/seats/lib/check-seat-category";

function clientReturning(result: { data?: unknown; error?: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as never, from, eq };
}

describe("checkSeatCategory", () => {
  it("should allow an active category", async () => {
    const { client, from, eq } = clientReturning({ data: { is_active: true } });

    await expect(checkSeatCategory(client, "cat-1")).resolves.toEqual({
      allowed: true,
    });
    expect(from).toHaveBeenCalledWith("seat_categories");
    expect(eq).toHaveBeenCalledWith("id", "cat-1");
  });

  it("should reject an inactive category on create", async () => {
    const { client } = clientReturning({ data: { is_active: false } });

    await expect(checkSeatCategory(client, "cat-1")).resolves.toEqual({
      allowed: false,
    });
  });

  it("should allow an inactive category when it is the seat's current one", async () => {
    const { client } = clientReturning({ data: { is_active: false } });

    await expect(checkSeatCategory(client, "cat-1", "cat-1")).resolves.toEqual({
      allowed: true,
    });
  });

  it("should reject switching to a different inactive category on update", async () => {
    const { client } = clientReturning({ data: { is_active: false } });

    await expect(checkSeatCategory(client, "cat-2", "cat-1")).resolves.toEqual({
      allowed: false,
    });
  });

  it("should reject a category that does not exist or is hidden by RLS", async () => {
    const { client } = clientReturning({ data: null });

    await expect(checkSeatCategory(client, "missing")).resolves.toEqual({
      allowed: false,
    });
  });

  it("should return the database error when the lookup fails", async () => {
    const error = { code: "XX000", message: "boom" };
    const { client } = clientReturning({ data: null, error });

    await expect(checkSeatCategory(client, "cat-1")).resolves.toEqual({ error });
  });
});
