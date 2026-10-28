import { describe, expect, it } from "vitest";

import { endOfUtcDay, selectTodaysJobs, type TodayJobRow } from "@/features/jobs/lib/todays-jobs";

const NOW = new Date("2026-10-28T10:00:00Z");

const row = (id: string, pickup_at: string, overrides: Partial<TodayJobRow> = {}): TodayJobRow => ({
  id,
  status: "assigned",
  vehicle_bay: null,
  technician: { full_name: "Omar Haddad" },
  booking: {
    booking_number: `BK-${id}`,
    pickup_at,
    vehicle: null,
    vehicle_bay: null,
    airport: { code: "DXB", name: "Dubai International", city: "Dubai", timezone: "Asia/Dubai" },
    required_category: null,
    seat: null,
    flight: null,
  },
  ...overrides,
});

describe("selectTodaysJobs", () => {
  it("should list today's open jobs with the earliest first", () => {
    const { jobs } = selectTodaysJobs(
      [row("b", "2026-10-28T15:00:00Z"), row("a", "2026-10-28T11:00:00Z"), row("c", "2026-10-28T13:00:00Z")],
      NOW,
    );

    expect(jobs.map((job) => job.id)).toEqual(["a", "c", "b"]);
  });

  it("should break a tie by id, so the order does not change between reads", () => {
    const { jobs } = selectTodaysJobs([row("2", "2026-10-28T12:00:00Z"), row("1", "2026-10-28T12:00:00Z")], NOW);

    expect(jobs.map((job) => job.id)).toEqual(["1", "2"]);
  });

  it("should leave out completed and cancelled jobs and a job with no booking", () => {
    const { jobs } = selectTodaysJobs(
      [
        row("done", "2026-10-28T12:00:00Z", { status: "completed" }),
        row("off", "2026-10-28T12:00:00Z", { status: "cancelled" }),
        row("none", "2026-10-28T12:00:00Z", { booking: null }),
        row("open", "2026-10-28T12:00:00Z", { status: "in_progress" }),
      ],
      NOW,
    );

    expect(jobs.map((job) => job.id)).toEqual(["open"]);
  });

  it("should keep a job of an earlier day on top", () => {
    const { jobs } = selectTodaysJobs([row("today", "2026-10-28T12:00:00Z"), row("late", "2026-10-27T09:00:00Z")], NOW);

    expect(jobs.map((job) => job.id)).toEqual(["late", "today"]);
  });

  it("should treat the last minute of the UTC day as today and midnight as tomorrow", () => {
    const { jobs, next_pickup_at } = selectTodaysJobs(
      [row("last", "2026-10-28T23:59:00Z"), row("next", "2026-10-29T00:00:00Z")],
      NOW,
    );

    expect(jobs.map((job) => job.id)).toEqual(["last"]);
    expect(next_pickup_at).toBe("2026-10-29T00:00:00Z");
    expect(endOfUtcDay(NOW)).toBe(Date.parse("2026-10-29T00:00:00Z"));
  });

  it("should keep a job in progress on the list when its pickup is after today", () => {
    const result = selectTodaysJobs(
      [row("started", "2026-10-29T08:00:00Z", { status: "in_progress" }), row("later", "2026-10-30T08:00:00Z")],
      NOW,
    );

    expect(result.jobs.map((job) => job.id)).toEqual(["started"]);
    expect(result.next_pickup_at).toBe("2026-10-30T08:00:00Z");
  });

  it("should give the first pickup after today when there is no job today", () => {
    const result = selectTodaysJobs([row("b", "2026-10-31T08:00:00Z"), row("a", "2026-10-30T08:00:00Z")], NOW);

    expect(result.jobs).toEqual([]);
    expect(result.next_pickup_at).toBe("2026-10-30T08:00:00Z");
  });

  it("should give no next pickup when no job is left", () => {
    expect(selectTodaysJobs([], NOW)).toEqual({ jobs: [], next_pickup_at: null });
  });

  it("should carry the booking, the seat, the category, the technician and the early flight of a job", () => {
    const { jobs } = selectTodaysJobs(
      [
        {
          ...row("a", "2026-10-28T12:00:00Z", { vehicle_bay: "C-14" }),
          booking: {
            booking_number: "BK-2026-000123",
            pickup_at: "2026-10-28T12:00:00Z",
            vehicle: "Toyota RAV4 · DXB A 48291",
            vehicle_bay: "Z9",
            airport: { code: "DXB", name: "Dubai International", city: "Dubai", timezone: "Asia/Dubai" },
            required_category: { name: "Convertible" },
            seat: { serial_number: "SEAT-0001" },
            flight: {
              flight_number: "EK 203",
              terminal: "3",
              last_synced_at: "2026-10-28T09:58:00Z",
              scheduled_arrival_at: "2026-10-28T12:30:00Z",
              estimated_arrival_at: "2026-10-28T11:45:00Z",
              actual_arrival_at: null,
              delay_minutes: null,
            },
          },
        },
      ],
      NOW,
    );

    expect(jobs[0]).toMatchObject({
      booking_number: "BK-2026-000123",
      technician: "Omar Haddad",
      vehicle_bay: "C-14",
      required_category: "Convertible",
      seat: "SEAT-0001",
      flight: { flight_number: "EK 203", terminal: "3", timing: "early", offset_minutes: -45 },
    });
  });
});
