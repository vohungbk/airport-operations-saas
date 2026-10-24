import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  BOOKING_REVENUE_SELECT,
  getBookingRevenue,
} from "@/features/bookings/lib/get-booking-revenue";

const BOOKING_ID = "f0000000-0000-0000-0000-000000000025";

function mockQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { from, select, eq };
}

describe("getBookingRevenue", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should return null without querying when the id is malformed", async () => {
    await expect(getBookingRevenue("not-an-id")).resolves.toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should read one booking in one query with its terms, using the user's own client", async () => {
    const q = mockQuery({ data: null, error: null });

    await getBookingRevenue(BOOKING_ID);

    expect(q.from).toHaveBeenCalledTimes(1);
    expect(q.from).toHaveBeenCalledWith("bookings");
    expect(q.select).toHaveBeenCalledWith(BOOKING_REVENUE_SELECT);
    expect(q.eq).toHaveBeenCalledWith("id", BOOKING_ID);
  });

  it("should return null for an unknown booking or one RLS hides", async () => {
    mockQuery({ data: null, error: null });

    await expect(getBookingRevenue(BOOKING_ID)).resolves.toBeNull();
  });

  it("should return the row", async () => {
    const row = { id: BOOKING_ID, booking_number: "BK-00025" };
    mockQuery({ data: row, error: null });

    await expect(getBookingRevenue(BOOKING_ID)).resolves.toEqual(row);
  });

  it("should throw when the query fails", async () => {
    mockQuery({ data: null, error: new Error("db down") });

    await expect(getBookingRevenue(BOOKING_ID)).rejects.toThrow("db down");
  });

  it("should not select fees, the launch target, the partner's contact data or free text", () => {
    for (const column of ["annual_fee", "onboarding_fee", "launch_credit_target", "contact_email", "notes", "vat_rate"]) {
      expect(BOOKING_REVENUE_SELECT).not.toContain(column);
    }
  });
});
