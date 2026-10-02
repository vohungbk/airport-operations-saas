import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getBookingEvents } from "@/features/bookings/lib/get-booking-events";

const ID = "f0000000-0000-4000-8000-000000000001";
const SEAT_1 = "e0000000-0000-0000-0000-000000000001";
const SEAT_2 = "e0000000-0000-0000-0000-000000000002";

function builder(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "in"]) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

describe("getBookingEvents", () => {
  let tables: string[];
  let results: unknown[];

  beforeEach(() => {
    tables = [];
    results = [];
    createClientMock.mockReset();
    createClientMock.mockResolvedValue({
      from: (table: string) => {
        tables.push(table);
        return builder(results.shift());
      },
    });
  });

  it("should return nothing without querying when the id is not a uuid", async () => {
    await expect(getBookingEvents("nope")).resolves.toEqual({
      items: [],
      truncated: false,
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should resolve seat serials for all seat changes with a single seats query", async () => {
    results.push({
      data: [
        {
          id: "e1",
          from_status: "confirmed",
          to_status: "confirmed",
          notes: null,
          created_at: "2026-09-02T00:00:00Z",
          actor: { full_name: "Ops" },
          metadata: { event_type: "seat_changed", from_seat_id: SEAT_1, to_seat_id: SEAT_2 },
        },
        {
          id: "e2",
          from_status: "pending",
          to_status: "confirmed",
          notes: null,
          created_at: "2026-09-01T00:00:00Z",
          actor: null,
          metadata: { event_type: "seat_changed", from_seat_id: null, to_seat_id: SEAT_1 },
        },
      ],
      error: null,
    });
    results.push({
      data: [
        { id: SEAT_1, serial_number: "SEAT-0001" },
        { id: SEAT_2, serial_number: "SEAT-0002" },
      ],
      error: null,
    });

    const { items } = await getBookingEvents(ID);

    expect(tables).toEqual(["booking_events", "seats"]);
    expect(items[0]).toMatchObject({
      event_type: "seat_changed",
      actor_name: "Ops",
      from_seat_serial: "SEAT-0001",
      to_seat_serial: "SEAT-0002",
    });
    expect(items[1].actor_name).toBeNull();
    expect(items[1].from_seat_serial).toBeNull();
  });

  it("should not query seats when no event references one", async () => {
    results.push({
      data: [
        {
          id: "e1",
          from_status: null,
          to_status: "pending",
          notes: null,
          created_at: "2026-09-01T00:00:00Z",
          actor: null,
          metadata: { event_type: "created" },
        },
      ],
      error: null,
    });

    const { items, truncated } = await getBookingEvents(ID);

    expect(tables).toEqual(["booking_events"]);
    expect(items[0].event_type).toBe("created");
    expect(truncated).toBe(false);
  });

  it("should treat an unknown event_type as null instead of failing", async () => {
    results.push({
      data: [
        {
          id: "e1",
          from_status: null,
          to_status: "pending",
          notes: null,
          created_at: "2026-09-01T00:00:00Z",
          actor: null,
          metadata: { event_type: "something_new" },
        },
      ],
      error: null,
    });

    const { items } = await getBookingEvents(ID);

    expect(items[0].event_type).toBeNull();
  });
});
