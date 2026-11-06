import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.types";

import { linkBookingFlight } from "./link-booking-flight";
import { createSimulatorAdapter } from "./provider/fixture-adapters";
import type { FlightSourceAdapter } from "./provider/flight-source";

const BOOKING = { id: "booking-1", airport_id: "airport-1" };

interface Write {
  table: string;
  op: "update" | "insert";
  values: Record<string, unknown>;
}

/** A fake client that records the writes. `existingFlightId` is the flight the lookup finds, if any. */
function fakeClient(options: { existingFlightId?: string; failBookingUpdate?: boolean } = {}) {
  const writes: Write[] = [];

  const client = {
    from(table: string) {
      return {
        select: () => {
          const query = {
            eq: () => query,
            order: () => query,
            limit: () => query,
            maybeSingle: async () => ({
              data: options.existingFlightId ? { id: options.existingFlightId } : null,
              error: null,
            }),
          };
          return query;
        },
        update: (values: Record<string, unknown>) => {
          writes.push({ table, op: "update", values });
          const result = {
            error: table === "bookings" && options.failBookingUpdate ? new Error("db") : null,
          };
          return { eq: () => Object.assign(Promise.resolve(result), result) };
        },
        insert: (values: Record<string, unknown>) => {
          writes.push({ table, op: "insert", values });
          return { select: () => ({ single: async () => ({ data: { id: "flight-new" }, error: null }) }) };
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient<Database>, writes };
}

const bookingWrite = (writes: Write[]) => writes.filter((write) => write.table === "bookings");

describe("linkBookingFlight", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("should create the flight and link it when the source knows the number", async () => {
    const { client, writes } = fakeClient();

    const result = await linkBookingFlight(client, BOOKING, "SIM001", createSimulatorAdapter);

    expect(result).toBe("linked");
    expect(writes.find((write) => write.table === "flights")).toMatchObject({
      op: "insert",
      values: { flight_number: "SIM001", airport_id: "airport-1", provider: "simulator" },
    });
    expect(bookingWrite(writes)).toEqual([
      {
        table: "bookings",
        op: "update",
        values: { flight_id: "flight-new", flight_number: "SIM001", flight_lookup_status: "linked" },
      },
    ]);
  });

  it("should store the actual arrival when the source says the flight has landed", async () => {
    const { client, writes } = fakeClient();
    const landed: FlightSourceAdapter = {
      source: "simulator",
      fetchFlight: async (flight_number) => ({
        flight_number,
        status: "landed",
        scheduled_arrival_at: "2026-10-24T12:30:00.000Z",
        estimated_arrival_at: "2026-10-24T11:45:00.000Z",
        actual_arrival_at: "2026-10-24T11:40:00.000Z",
        terminal: "3",
        delay_minutes: null,
      }),
    };

    const result = await linkBookingFlight(client, BOOKING, "EK203", () => landed);

    expect(result).toBe("linked");
    expect(writes.find((write) => write.table === "flights")).toMatchObject({
      op: "insert",
      values: { status: "landed", actual_arrival_at: "2026-10-24T11:40:00.000Z" },
    });
  });

  it("should update the flight it already has instead of creating a second one", async () => {
    const { client, writes } = fakeClient({ existingFlightId: "flight-old" });

    await linkBookingFlight(client, BOOKING, "SIM002", createSimulatorAdapter);

    expect(writes.filter((write) => write.table === "flights")).toEqual([
      expect.objectContaining({ op: "update", values: expect.objectContaining({ status: "delayed" }) }),
    ]);
    expect(bookingWrite(writes)[0].values).toMatchObject({ flight_id: "flight-old" });
  });

  it("should clear the Manual mark of the flight it updates, because the source has answered (VI-F02-S07)", async () => {
    const { client, writes } = fakeClient({ existingFlightId: "flight-old" });

    await linkBookingFlight(client, BOOKING, "SIM002", createSimulatorAdapter);

    expect(writes.filter((write) => write.table === "flights")[0].values).toMatchObject({
      manual_entered_at: null,
      manual_reason: null,
    });
  });

  it("should normalize the number before it asks the source", async () => {
    const { client, writes } = fakeClient();

    await linkBookingFlight(client, BOOKING, " sim 001 ", createSimulatorAdapter);

    expect(bookingWrite(writes)[0].values).toMatchObject({ flight_number: "SIM001" });
  });

  it("should mark the flight not found, with no flight linked, when the source does not know the number", async () => {
    const { client, writes } = fakeClient();

    const result = await linkBookingFlight(client, BOOKING, "NOPE1", createSimulatorAdapter);

    expect(result).toBe("not_found");
    expect(writes.filter((write) => write.table === "flights")).toEqual([]);
    expect(bookingWrite(writes)[0].values).toEqual({
      flight_id: null,
      flight_number: "NOPE1",
      flight_lookup_status: "not_found",
    });
  });

  it("should not ask the source or write anything for a new booking without a flight number", async () => {
    const { client, writes } = fakeClient();
    const source = vi.fn();

    const result = await linkBookingFlight(client, BOOKING, "  ", source);

    expect(result).toBe("cleared");
    expect(source).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("should not ask the source again when the same number is already linked", async () => {
    const { client, writes } = fakeClient();
    const source = vi.fn();

    const result = await linkBookingFlight(
      client,
      { ...BOOKING, flight_number: "SIM001", flight_lookup_status: "linked" },
      "sim001",
      source,
    );

    expect(result).toBe("linked");
    expect(source).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("should look the same number up again when it was not found the last time", async () => {
    const { client, writes } = fakeClient();

    const result = await linkBookingFlight(
      client,
      { ...BOOKING, flight_number: "SIM001", flight_lookup_status: "not_found" },
      "SIM001",
      createSimulatorAdapter,
    );

    expect(result).toBe("linked");
    expect(bookingWrite(writes)[0].values).toMatchObject({ flight_lookup_status: "linked" });
  });

  it("should unlink the flight when the number of a booking that had one is emptied", async () => {
    const { client, writes } = fakeClient();

    const result = await linkBookingFlight(client, { ...BOOKING, flight_number: "OLD1" }, "", vi.fn());

    expect(result).toBe("cleared");
    expect(bookingWrite(writes)[0].values).toEqual({
      flight_id: null,
      flight_number: null,
      flight_lookup_status: null,
    });
  });

  it("should keep the number and report unavailable when the source fails", async () => {
    const { client, writes } = fakeClient();
    const failing: FlightSourceAdapter = {
      source: "provider",
      fetchFlight: async () => {
        throw new Error("provider down");
      },
    };

    const result = await linkBookingFlight(client, BOOKING, "VN123", () => failing);

    expect(result).toBe("unavailable");
    expect(bookingWrite(writes)[0].values).toEqual({
      flight_id: null,
      flight_number: "VN123",
      flight_lookup_status: null,
    });
  });

  it("should report unavailable instead of throwing when the booking cannot be written", async () => {
    const { client } = fakeClient({ failBookingUpdate: true });

    await expect(linkBookingFlight(client, BOOKING, "SIM001", createSimulatorAdapter)).resolves.toBe(
      "unavailable",
    );
  });
});
