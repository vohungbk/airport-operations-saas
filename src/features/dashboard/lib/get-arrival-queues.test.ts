import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getArrivalQueues, toArrivalQueues } from "@/features/dashboard/lib/get-arrival-queues";

const NOW = new Date("2026-10-24T10:04:00Z");

const row = (overrides: Record<string, unknown> = {}) => ({
  queue: "arrivals",
  booking_id: "bk-1",
  booking_number: "BK-2026-000123",
  status: "assigned",
  expected_at: "2026-10-24T11:45:00Z",
  timezone: "Asia/Dubai",
  ...overrides,
});

describe("toArrivalQueues", () => {
  it("should split the rows by queue and name the status as the design does", () => {
    const queues = toArrivalQueues([
      row(),
      row({ queue: "upcoming", booking_id: "bk-2", booking_number: "BK-2026-000200", status: "pending" }),
    ]);

    expect(queues.arrivals_today.map((item) => item.booking_number)).toEqual(["BK-2026-000123"]);
    expect(queues.arrivals_today[0].status_label).toBe("Technician Assigned");
    expect(queues.upcoming_bookings.map((item) => item.status_label)).toEqual(["New"]);
  });

  it("should show the time for an arrival and the date too for an upcoming booking, in the airport time zone", () => {
    const queues = toArrivalQueues([row(), row({ queue: "upcoming", booking_id: "bk-2" })]);

    expect(queues.arrivals_today[0].arrival_label).toBe("15:45 GST");
    expect(queues.upcoming_bookings[0].arrival_label).toBe("24 Oct, 15:45 GST");
  });

  it("should give empty lists, not a failure, when no booking is coming", () => {
    expect(toArrivalQueues([])).toEqual({ arrivals_today: [], upcoming_bookings: [] });
  });
});

describe("getArrivalQueues (VI-F11-S02, AC01)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should read the queues with the time of now as the signed-in user", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row()], error: null });
    createClientMock.mockResolvedValue({ rpc });

    const queues = await getArrivalQueues(NOW);

    expect(rpc).toHaveBeenCalledWith("command_centre_arrival_queues", { p_now: NOW.toISOString() });
    expect(queues?.arrivals_today[0]).toMatchObject({ booking_id: "bk-1" });
  });

  it("should give null when the read fails, never an empty list", async () => {
    createClientMock.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) });

    await expect(getArrivalQueues(NOW)).resolves.toBeNull();
  });

  it("should give null when the client cannot be created", async () => {
    createClientMock.mockRejectedValue(new Error("no session"));

    await expect(getArrivalQueues(NOW)).resolves.toBeNull();
  });
});
