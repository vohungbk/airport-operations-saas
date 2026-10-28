import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getSeatBySerial } from "@/features/seats/lib/get-seat-by-serial";

const SEAT = { id: "s-1", serial_number: "SEAT-0001" };

/** The exact query ends in `maybeSingle`; the any-case query ends in `limit`. */
function mockQueries(exact: { data: unknown; error: unknown }, anyCase?: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(exact);
  const eq = vi.fn(() => ({ maybeSingle }));
  const limit = vi.fn().mockResolvedValue(anyCase ?? { data: [], error: null });
  const ilike = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ eq, ilike }));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { eq, ilike };
}

describe("getSeatBySerial", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should return the seat with exactly this serial, without a second query", async () => {
    const { eq, ilike } = mockQueries({ data: SEAT, error: null });

    await expect(getSeatBySerial("SEAT-0001")).resolves.toEqual(SEAT);
    expect(eq).toHaveBeenCalledWith("serial_number", "SEAT-0001");
    expect(ilike).not.toHaveBeenCalled();
  });

  it("should find the seat when the typed text differs only by case and names one seat", async () => {
    mockQueries({ data: null, error: null }, { data: [SEAT], error: null });

    await expect(getSeatBySerial("seat-0001")).resolves.toEqual(SEAT);
  });

  it("should not guess when the text in another case names two seats", async () => {
    mockQueries({ data: null, error: null }, { data: [SEAT, { id: "s-2" }], error: null });

    await expect(getSeatBySerial("seat-0001")).resolves.toBeNull();
  });

  it("should return null for an unknown serial or a seat RLS hides", async () => {
    mockQueries({ data: null, error: null }, { data: [], error: null });

    await expect(getSeatBySerial("SEAT-9999")).resolves.toBeNull();
  });

  it("should treat % and _ in the text as characters, not as wildcards", async () => {
    const { ilike } = mockQueries({ data: null, error: null });

    await getSeatBySerial("A_%1");

    expect(ilike).toHaveBeenCalledWith("serial_number", "A\\_\\%1");
  });

  it("should throw when a query fails", async () => {
    mockQueries({ data: null, error: new Error("db down") });

    await expect(getSeatBySerial("SEAT-0001")).rejects.toThrow("db down");
  });
});
