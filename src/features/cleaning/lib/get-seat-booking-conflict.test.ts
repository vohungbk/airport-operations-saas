import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  CLEANING_PERIOD_HOURS,
  getSeatBookingConflict,
} from "@/features/cleaning/lib/get-seat-booking-conflict";

const NOW = new Date("2026-11-04T07:00:00Z");

function mockQuery(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown[]> = {};
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "eq", "neq", "in", "lt", "gt", "order", "limit"]) {
    chain[name] = vi.fn((...args: unknown[]) => {
      calls[name] = args;
      return chain;
    });
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  createClientMock.mockResolvedValue({ from: vi.fn(() => chain) });
  return calls;
}

describe("getSeatBookingConflict", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should ask for another booking of the seat that overlaps the cleaning period", async () => {
    const calls = mockQuery({ data: null, error: null });

    await getSeatBookingConflict("seat-1", "booking-1", NOW);

    expect(calls.eq).toEqual(["assigned_seat_id", "seat-1"]);
    expect(calls.neq).toEqual(["id", "booking-1"]);
    expect(calls.lt).toEqual([
      "pickup_at",
      new Date(NOW.getTime() + CLEANING_PERIOD_HOURS * 3_600_000).toISOString(),
    ]);
    expect(calls.gt).toEqual(["return_at", NOW.toISOString()]);
  });

  it("should return null when no booking holds the seat", async () => {
    mockQuery({ data: null, error: null });

    await expect(getSeatBookingConflict("seat-1", "booking-1", NOW)).resolves.toBeNull();
  });

  it("should return the booking that holds the seat", async () => {
    const booking = {
      id: "b-2",
      booking_number: "BK-2026-000200",
      pickup_at: "2026-11-04T08:00:00Z",
      return_at: "2026-11-04T12:00:00Z",
    };
    mockQuery({ data: booking, error: null });

    await expect(getSeatBookingConflict("seat-1", "booking-1", NOW)).resolves.toEqual(booking);
  });

  it("should throw when the query fails", async () => {
    mockQuery({ data: null, error: new Error("boom") });

    await expect(getSeatBookingConflict("seat-1", "booking-1", NOW)).rejects.toThrow("boom");
  });
});
