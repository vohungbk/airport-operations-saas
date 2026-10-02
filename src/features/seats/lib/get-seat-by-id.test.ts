import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn(() => ({ maybeSingle: maybeSingleMock })));
const selectMock = vi.hoisted(() => vi.fn(() => ({ eq: eqMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ select: selectMock })));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

import { getSeatById } from "@/features/seats/lib/get-seat-by-id";

const ID = "e0000000-0000-4000-8000-000000000001";

describe("getSeatById", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    eqMock.mockClear();
    selectMock.mockClear();
    fromMock.mockClear();
  });

  it("should return the seat with its category and airport when found", async () => {
    const seat = {
      id: ID,
      serial_number: "SEAT-0001",
      category: { id: "c1", name: "Infant Carrier" },
      airport: { id: "a1", code: "DXB", name: "Dubai" },
    };
    maybeSingleMock.mockResolvedValue({ data: seat, error: null });

    await expect(getSeatById(ID)).resolves.toEqual(seat);
    expect(fromMock).toHaveBeenCalledWith("seats");
    expect(eqMock).toHaveBeenCalledWith("id", ID);
    expect(selectMock.mock.calls[0]).toEqual([
      expect.stringContaining("category:seat_categories"),
    ]);
  });

  it("should return null when the seat is missing or hidden by RLS", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(getSeatById(ID)).resolves.toBeNull();
  });

  it("should return null without querying when the id is not a uuid", async () => {
    await expect(getSeatById("not-a-uuid")).resolves.toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should throw database errors so the error boundary renders", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "boom" },
    });

    await expect(getSeatById(ID)).rejects.toEqual({
      code: "XX000",
      message: "boom",
    });
  });
});
