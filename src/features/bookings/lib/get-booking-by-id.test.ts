import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn(() => ({ maybeSingle: maybeSingleMock })));
const selectMock = vi.hoisted(() => vi.fn(() => ({ eq: eqMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ select: selectMock })));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

import { getBookingById } from "@/features/bookings/lib/get-booking-by-id";

const ID = "f0000000-0000-4000-8000-000000000001";

describe("getBookingById", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    eqMock.mockClear();
    selectMock.mockClear();
    fromMock.mockClear();
  });

  it("should return the booking with its relations when found", async () => {
    const booking = { id: ID, booking_number: "BK-00001" };
    maybeSingleMock.mockResolvedValue({ data: booking, error: null });

    await expect(getBookingById(ID)).resolves.toEqual(booking);
    expect(fromMock).toHaveBeenCalledWith("bookings");
    expect(eqMock).toHaveBeenCalledWith("id", ID);
    expect(selectMock.mock.calls[0]).toEqual([
      expect.stringContaining("partner:partners"),
    ]);
  });

  it("should return null when the booking is missing or hidden by RLS", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(getBookingById(ID)).resolves.toBeNull();
  });

  it("should return null without querying when the id is not a uuid", async () => {
    await expect(getBookingById("not-a-uuid")).resolves.toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should throw on a database error", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(getBookingById(ID)).rejects.toThrow("boom");
  });
});
