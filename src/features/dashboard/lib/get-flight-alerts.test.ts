import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getFlightAlerts } from "@/features/dashboard/lib/get-flight-alerts";

const NOW = new Date("2026-11-04T10:00:00Z");

function mockFlights(data: unknown[], error: unknown = null) {
  const request = {
    gte: vi.fn(() => request),
    lte: vi.fn(() => request),
    order: vi.fn(() => request),
    limit: vi.fn(() => request),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  const select = vi.fn<(columns: string) => typeof request>(() => request);
  createClientMock.mockResolvedValue({ from: vi.fn(() => ({ select })) });
  return { select };
}

const flight = (overrides: Record<string, unknown> = {}) => ({
  id: "f-1",
  flight_number: "EK 215",
  status: "delayed",
  scheduled_arrival_at: "2026-11-04T12:00:00Z",
  estimated_arrival_at: "2026-11-04T12:50:00Z",
  actual_arrival_at: null,
  delay_minutes: null,
  airport: { timezone: "Asia/Dubai" },
  bookings: [
    {
      booking_number: "BK-2026-000123",
      status: "confirmed",
      technician_jobs: [
        { deadline_at: "2026-11-04T12:55:00Z", status: "assigned", job_type: "installation" },
      ],
    },
  ],
  ...overrides,
});

describe("getFlightAlerts deadline (UI-F06-T01, AC03)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should ask for the deadline of the jobs of the linked booking in the same select", async () => {
    const { select } = mockFlights([]);

    await getFlightAlerts(NOW);

    expect(select.mock.calls[0][0]).toContain("technician_jobs(deadline_at, status, job_type)");
  });

  it("should give the new deadline in the zone of the airport for a delayed flight", async () => {
    mockFlights([flight()]);

    const [alert] = await getFlightAlerts(NOW);

    expect(alert.kind).toBe("delayed");
    expect(alert.deadline_label).toBe("16:55 GST");
  });

  it("should give the earliest deadline when the booking has more than one open installation job", async () => {
    mockFlights([
      flight({
        bookings: [
          {
            booking_number: "BK-1",
            technician_jobs: [
              { deadline_at: "2026-11-04T13:30:00Z", status: "assigned", job_type: "installation" },
              { deadline_at: "2026-11-04T12:55:00Z", status: "in_progress", job_type: "installation" },
            ],
          },
        ],
      }),
    ]);

    expect((await getFlightAlerts(NOW))[0].deadline_label).toBe("16:55 GST");
  });

  it("should give no deadline when the job has none, is not an installation, or is no longer open", async () => {
    const jobs = [
      { deadline_at: null, status: "assigned", job_type: "installation" },
      { deadline_at: "2026-11-04T12:55:00Z", status: "assigned", job_type: "cleaning" },
      { deadline_at: "2026-11-04T12:55:00Z", status: "completed", job_type: "installation" },
    ];
    mockFlights([flight({ bookings: [{ booking_number: "BK-1", technician_jobs: jobs }] })]);

    expect((await getFlightAlerts(NOW))[0].deadline_label).toBeNull();
  });

  it("should give no deadline when no booking is linked", async () => {
    mockFlights([flight({ bookings: [] })]);

    expect((await getFlightAlerts(NOW))[0].deadline_label).toBeNull();
  });

  it("should give no deadline for an early flight", async () => {
    mockFlights([flight({ estimated_arrival_at: "2026-11-04T11:10:00Z" })]);

    const [alert] = await getFlightAlerts(NOW);

    expect(alert.kind).toBe("early");
    expect(alert.deadline_label).toBeNull();
  });
});

describe("getFlightAlerts cancelled or diverted (VI-F02-S06)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should ask for the status of the flight in the same select", async () => {
    const { select } = mockFlights([]);

    await getFlightAlerts(NOW);

    expect(select.mock.calls[0][0]).toContain("flight_number, status,");
  });

  it("should flag a cancelled flight with its booking and not read its old estimate", async () => {
    mockFlights([flight({ status: "cancelled", estimated_arrival_at: "2026-11-04T11:10:00Z" })]);

    expect(await getFlightAlerts(NOW)).toEqual([
      expect.objectContaining({ kind: "cancelled", minutes: 0, booking_number: "BK-2026-000123", deadline_label: null }),
    ]);
  });

  it("should put the cancelled and diverted flags before the early and delayed banners", async () => {
    mockFlights([
      flight({ id: "f-1", status: "scheduled" }),
      flight({ id: "f-2", status: "diverted" }),
      flight({ id: "f-3", status: "cancelled" }),
    ]);

    expect((await getFlightAlerts(NOW)).map((alert) => alert.kind)).toEqual(["diverted", "cancelled", "delayed"]);
  });

  it("should give no flag when the booking of the cancelled flight is already finished or cancelled", async () => {
    const closed = (status: string) => ({ booking_number: "BK-1", status, technician_jobs: [] });
    mockFlights([
      flight({ id: "f-1", status: "cancelled", bookings: [closed("completed")] }),
      flight({ id: "f-2", status: "diverted", bookings: [closed("cancelled")] }),
      flight({ id: "f-3", status: "cancelled", bookings: [] }),
    ]);

    expect(await getFlightAlerts(NOW)).toEqual([]);
  });

  it("should name the open booking when the flight also has a closed one", async () => {
    mockFlights([
      flight({
        status: "cancelled",
        bookings: [
          { booking_number: "BK-OLD", status: "completed", technician_jobs: [] },
          { booking_number: "BK-OPEN", status: "ready", technician_jobs: [] },
        ],
      }),
    ]);

    expect((await getFlightAlerts(NOW))[0].booking_number).toBe("BK-OPEN");
  });

  it("should give no flag for a flight that is scheduled, delayed or landed on time", async () => {
    mockFlights([flight({ status: "landed", estimated_arrival_at: "2026-11-04T12:00:00Z" })]);

    expect(await getFlightAlerts(NOW)).toEqual([]);
  });
});
