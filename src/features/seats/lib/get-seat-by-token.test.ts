import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  getSeatByPublicToken,
  SCANNED_SEAT_SELECT,
} from "@/features/seats/lib/get-seat-by-token";

const TOKEN = "00000000-0000-4000-8000-0000000000a1";

function mockQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { from, select, eq };
}

describe("getSeatByPublicToken", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it.each([
    ["an empty token", ""],
    ["a token with a slash", "a/b"],
    ["a filter trick", "x' or '1'='1"],
    ["a token that is too long", "a".repeat(129)],
  ])("should return null without querying for %s", async (_name, token) => {
    await expect(getSeatByPublicToken(token)).resolves.toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should ask for one seat by its token in one query, with the user's own client", async () => {
    const q = mockQuery({ data: null, error: null });

    await getSeatByPublicToken(TOKEN);

    expect(q.from).toHaveBeenCalledWith("seats");
    expect(q.select).toHaveBeenCalledWith(SCANNED_SEAT_SELECT);
    expect(q.eq).toHaveBeenCalledWith("public_token", TOKEN);
  });

  it("should return null for an unknown token or a seat RLS hides", async () => {
    mockQuery({ data: null, error: null });

    await expect(getSeatByPublicToken(TOKEN)).resolves.toBeNull();
  });

  it("should return the seat row", async () => {
    const seat = { id: "s-1", serial_number: "SEAT-1", status: "quarantine" };
    mockQuery({ data: seat, error: null });

    await expect(getSeatByPublicToken(TOKEN)).resolves.toEqual(seat);
  });

  it("should throw when the query fails", async () => {
    mockQuery({ data: null, error: new Error("db down") });

    await expect(getSeatByPublicToken(TOKEN)).rejects.toThrow("db down");
  });

  it("should never select the token, price, partner, rental count or booking data", () => {
    for (const column of ["public_token", "daily_rate", "partner", "rental_cycles", "booking", "customer"]) {
      expect(SCANNED_SEAT_SELECT).not.toContain(column);
    }
  });
});
