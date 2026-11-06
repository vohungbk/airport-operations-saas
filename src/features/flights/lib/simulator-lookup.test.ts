import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { lookupSimulatorFlight } from "@/features/flights/lib/simulator-lookup";

const NOW = new Date("2026-10-24T09:00:00Z");

function mockFlights(data: unknown[], error: unknown = null) {
  const request = {
    eq: vi.fn(() => request),
    not: vi.fn(() => request),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  const select = vi.fn<(columns: string) => typeof request>(() => request);
  createClientMock.mockResolvedValue({ from: vi.fn(() => ({ select })) });
  return { select, request };
}

const flight = (overrides: Record<string, unknown> = {}) => ({
  id: "f-1",
  scheduled_arrival_at: "2026-10-24T12:30:00Z",
  airport: { code: "DXB", name: "Dubai International Airport", timezone: "Asia/Dubai" },
  bookings: [
    {
      pickup_at: "2026-10-24T13:00:00Z",
      created_at: "2026-10-02T00:00:00Z",
      technician_jobs: [{ deadline_at: "2026-10-24T11:30:00Z", status: "assigned", job_type: "installation" }],
    },
    { pickup_at: "2026-10-24T14:00:00Z", created_at: "2026-10-01T00:00:00Z", technician_jobs: [] },
  ],
  ...overrides,
});

describe("lookupSimulatorFlight (VI-F02-T02)", () => {
  beforeEach(() => createClientMock.mockReset());

  it("should ask only for flights with an open booking, by number", async () => {
    const { request } = mockFlights([]);

    await lookupSimulatorFlight("EK203", NOW);

    expect(request.eq).toHaveBeenCalledWith("flight_number", "EK203");
    expect(request.not).toHaveBeenCalledWith("bookings.status", "in", "(completed,cancelled,no_show)");
  });

  it("should give the airport, the schedule and the oldest booking with its stored installation deadline", async () => {
    mockFlights([flight({ bookings: [flight().bookings[0], { ...flight().bookings[1], technician_jobs: [{ deadline_at: "2026-10-24T11:40:00Z", status: "assigned", job_type: "installation" }] }] })]);

    expect(await lookupSimulatorFlight("EK203", NOW)).toEqual({
      flight_number: "EK203",
      airport_code: "DXB",
      airport_name: "Dubai International Airport",
      time_zone: "Asia/Dubai",
      scheduled_arrival_at: "2026-10-24T12:30:00Z",
      booking: { pickup_at: "2026-10-24T14:00:00Z", installation_deadline_at: "2026-10-24T11:40:00Z" },
    });
  });

  it("should take the flight whose schedule is nearest to now when a number has several", async () => {
    mockFlights([
      flight({ id: "far", scheduled_arrival_at: "2026-10-30T12:30:00Z" }),
      flight({ id: "near", scheduled_arrival_at: "2026-10-24T12:30:00Z" }),
    ]);

    expect((await lookupSimulatorFlight("EK203", NOW))?.scheduled_arrival_at).toBe("2026-10-24T12:30:00Z");
  });

  it("should give no deadline when the booking has no open installation job", async () => {
    mockFlights([flight({ bookings: [{ pickup_at: "2026-10-24T13:00:00Z", created_at: "2026-10-01T00:00:00Z", technician_jobs: [] }] })]);

    expect((await lookupSimulatorFlight("EK203", NOW))?.booking?.installation_deadline_at).toBeNull();
  });

  it("should give null when no open booking has a flight with the number", async () => {
    mockFlights([]);

    expect(await lookupSimulatorFlight("EK203", NOW)).toBeNull();
  });

  it("should throw when the read fails, so the caller can hide the error", async () => {
    mockFlights([], new Error("boom"));

    await expect(lookupSimulatorFlight("EK203", NOW)).rejects.toThrow("boom");
  });
});
