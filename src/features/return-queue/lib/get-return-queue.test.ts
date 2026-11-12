import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  getReturnChainItem,
  getReturnQueue,
  RETURN_QUEUE_MAX_ROWS,
  RETURN_QUEUE_SELECT,
} from "@/features/return-queue/lib/get-return-queue";

const BOOKING_ID = "b0000000-0000-0000-0000-000000000001";
const AIRPORT_ID = "a0000000-0000-0000-0000-000000000001";
const NOW = new Date("2026-11-04T07:02:00Z");

const ROW = {
  id: BOOKING_ID,
  booking_number: "BK-2026-000123",
  status: "cleaning",
  airport: { code: "DXB", timezone: "Asia/Dubai" },
  partner: { name: "Emirates Rent A Car" },
  seat: { id: "s-1", serial_number: "SEAT-0001", status: "cleaning" },
  events: [{ to_status: "cleaning", created_at: "2026-11-04T06:20:00Z" }],
  chain_steps: [],
};

/** A chainable query builder that resolves to `result` when awaited. */
function mockQuery(result: { data: unknown; error: unknown }) {
  const promise = Promise.resolve(result);
  const builder = {
    then: promise.then.bind(promise),
  } as unknown as Record<string, ReturnType<typeof vi.fn>>;
  for (const name of ["select", "in", "eq", "order", "limit"]) {
    builder[name] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  const from = vi.fn(() => builder);
  createClientMock.mockResolvedValue({ from });
  return { from, builder };
}

describe("getReturnQueue", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should read the bookings in the chain with the explicit columns and map them to rows", async () => {
    const { from, builder } = mockQuery({ data: [ROW], error: null });

    const items = await getReturnQueue(undefined, NOW);

    expect(from).toHaveBeenCalledWith("bookings");
    expect(builder.select).toHaveBeenCalledWith(RETURN_QUEUE_SELECT);
    expect(builder.in).toHaveBeenCalledWith("status", ["returned", "cleaning", "inspection"]);
    expect(builder.limit).toHaveBeenCalledWith(RETURN_QUEUE_MAX_ROWS);
    expect(builder.eq).not.toHaveBeenCalled();
    expect(items[0]).toMatchObject({ seat_serial_number: "SEAT-0001", waiting_minutes: 42 });
  });

  it("should narrow the query to the chosen airport", async () => {
    const { builder } = mockQuery({ data: [], error: null });

    await getReturnQueue(AIRPORT_ID, NOW);

    expect(builder.eq).toHaveBeenCalledWith("airport_id", AIRPORT_ID);
  });

  it("should not read partner contact or commercial data", () => {
    expect(RETURN_QUEUE_SELECT).not.toMatch(/email|phone|contact|rate|revenue|share/);
  });

  it("should throw when the query fails", async () => {
    mockQuery({ data: null, error: new Error("boom") });

    await expect(getReturnQueue(undefined, NOW)).rejects.toThrow("boom");
  });
});

describe("getReturnChainItem", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should return null without querying when the id is malformed", async () => {
    await expect(getReturnChainItem("not-an-id", NOW)).resolves.toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should return null when RLS hides the booking or it is not in the chain", async () => {
    mockQuery({ data: null, error: null });

    await expect(getReturnChainItem(BOOKING_ID, NOW)).resolves.toBeNull();
  });

  it("should return the chain row of a booking in the chain", async () => {
    const { builder } = mockQuery({ data: ROW, error: null });

    await expect(getReturnChainItem(BOOKING_ID, NOW)).resolves.toMatchObject({
      booking_id: BOOKING_ID,
      chain_step: "cleaning",
    });
    expect(builder.eq).toHaveBeenCalledWith("id", BOOKING_ID);
  });
});
