import { describe, expect, it } from "vitest";

import {
  buildFlightBoardAlerts,
  buildFlightBoardRows,
  formatZoneHeader,
  getFlightChange,
  getFlightPriority,
  getStaleLabel,
  getTodayInZone,
  type BoardFlightInput,
} from "./flight-board";

const NOW = new Date("2026-10-24T10:00:00Z");
const ZONE = "Asia/Dubai";

function flight(overrides: Partial<BoardFlightInput> = {}): BoardFlightInput {
  return {
    id: "f1",
    flight_number: "EK 203",
    status: "scheduled",
    scheduled_arrival_at: "2026-10-24T12:30:00Z",
    estimated_arrival_at: "2026-10-24T11:45:00Z",
    actual_arrival_at: null,
    delay_minutes: null,
    last_synced_at: "2026-10-24T09:55:00Z",
    bookings: [
      {
        id: "b1",
        booking_number: "BK-2026-000123",
        pickup_at: "2026-10-24T12:15:00Z",
        technician_jobs: [{ job_type: "installation", status: "assigned", deadline_at: "2026-10-24T10:45:00Z" }],
      },
    ],
    ...overrides,
  };
}

const at = (estimated: string) => flight({ estimated_arrival_at: estimated });

describe("getFlightChange", () => {
  it("should say early with the minutes when the flight arrives 45 minutes early", () => {
    expect(getFlightChange(flight())).toEqual({ kind: "early", minutes: 45, label: "Early 45 min" });
  });

  it("should say delayed with the minutes when the flight arrives 50 minutes late", () => {
    expect(getFlightChange(at("2026-10-24T13:20:00Z"))).toMatchObject({ kind: "delayed", minutes: 50, label: "Delayed 50 min" });
  });

  it("should say on time when the gap is under the 15 minute threshold", () => {
    expect(getFlightChange(at("2026-10-24T12:44:00Z")).kind).toBe("on_time");
    expect(getFlightChange(at("2026-10-24T12:16:00Z")).label).toBe("On time");
  });

  it("should treat exactly 15 minutes as early or delayed, never as on time", () => {
    expect(getFlightChange(at("2026-10-24T12:15:00Z")).kind).toBe("early");
    expect(getFlightChange(at("2026-10-24T12:45:00Z")).kind).toBe("delayed");
  });

  it("should say cancelled or diverted instead of a number of minutes", () => {
    expect(getFlightChange(flight({ status: "cancelled", estimated_arrival_at: null }))).toMatchObject({
      kind: "cancelled",
      label: "Cancelled",
      minutes: null,
    });
    expect(getFlightChange(flight({ status: "diverted" })).label).toBe("Diverted");
  });

  it("should show a dash and not invent a gap when there is no estimate and no delay", () => {
    expect(getFlightChange(flight({ estimated_arrival_at: null }))).toEqual({ kind: "unknown", minutes: null, label: "-" });
  });

  it("should use the stored delay when there is no estimate", () => {
    expect(getFlightChange(flight({ estimated_arrival_at: null, delay_minutes: 30 })).label).toBe("Delayed 30 min");
  });
});

describe("getFlightPriority", () => {
  it("should be high only for a flight that is 15 minutes or more early", () => {
    expect(getFlightPriority(getFlightChange(flight()))).toBe("high");
  });

  it("should stay normal for a delayed, cancelled or on time flight", () => {
    expect(getFlightPriority(getFlightChange(at("2026-10-24T13:20:00Z")))).toBe("normal");
    expect(getFlightPriority(getFlightChange(flight({ status: "cancelled" })))).toBe("normal");
    expect(getFlightPriority(getFlightChange(at("2026-10-24T12:30:00Z")))).toBe("normal");
  });
});

describe("getStaleLabel", () => {
  it("should say how old the data is when the last sync is over 30 minutes ago", () => {
    expect(getStaleLabel({ status: "scheduled", last_synced_at: "2026-10-24T09:15:00Z" }, NOW)).toBe("Stale · 45 min");
  });

  it("should give no tag for data that is fresh", () => {
    expect(getStaleLabel({ status: "scheduled", last_synced_at: "2026-10-24T09:45:00Z" }, NOW)).toBeNull();
  });

  it("should give no tag for a landed or cancelled flight, which is no longer refreshed", () => {
    expect(getStaleLabel({ status: "landed", last_synced_at: "2026-10-24T01:00:00Z" }, NOW)).toBeNull();
    expect(getStaleLabel({ status: "cancelled", last_synced_at: "2026-10-24T01:00:00Z" }, NOW)).toBeNull();
  });

  it("should say never updated when the flight never synced", () => {
    expect(getStaleLabel({ status: "scheduled", last_synced_at: null }, NOW)).toBe("Stale · never updated");
  });
});

describe("buildFlightBoardRows", () => {
  it("should write the times in the zone of the airport, the day above the time", () => {
    const [row] = buildFlightBoardRows([flight()], ZONE, NOW);

    expect(row.scheduled).toEqual({ date: "24 Oct", time: "16:30 GST" });
    expect(row.estimated).toEqual({ date: "24 Oct", time: "15:45 GST" });
    expect(row.deadline).toEqual({ date: "24 Oct", time: "14:45 GST" });
    expect(row.priority).toBe("high");
    expect(row.deadline_moved).toBe(true);
  });

  it("should make one row for each booking of a flight and none for a flight with no booking", () => {
    const shared = flight({
      bookings: [
        { id: "b1", booking_number: "BK-1", pickup_at: "2026-10-24T12:15:00Z", technician_jobs: null },
        { id: "b2", booking_number: "BK-2", pickup_at: "2026-10-24T12:15:00Z", technician_jobs: null },
      ],
    });

    expect(buildFlightBoardRows([shared], ZONE, NOW).map((row) => row.booking_number)).toEqual(["BK-1", "BK-2"]);
    expect(buildFlightBoardRows([flight({ bookings: [] }), flight({ bookings: null })], ZONE, NOW)).toEqual([]);
  });

  it("should show no estimate and no deadline when none is stored", () => {
    const [row] = buildFlightBoardRows(
      [flight({ status: "cancelled", estimated_arrival_at: null, bookings: [{ id: "b1", booking_number: "BK-9", pickup_at: "2026-10-24T12:15:00Z", technician_jobs: null }] })],
      ZONE,
      NOW,
    );

    expect(row.estimated).toBeNull();
    expect(row.deadline).toBeNull();
    expect(row.deadline_moved).toBe(false);
  });

  it("should fall back to the actual arrival when a landed flight has no estimate", () => {
    const [row] = buildFlightBoardRows(
      [flight({ status: "landed", estimated_arrival_at: null, actual_arrival_at: "2026-10-24T12:40:00Z" })],
      ZONE,
      NOW,
    );

    expect(row.estimated?.time).toBe("16:40 GST");
  });

  it("should not call the base deadline moved", () => {
    const base = flight({
      bookings: [
        {
          id: "b1",
          booking_number: "BK-1",
          pickup_at: "2026-10-24T12:00:00Z",
          technician_jobs: [{ job_type: "installation", status: "assigned", deadline_at: "2026-10-24T11:00:00Z" }],
        },
      ],
    });

    expect(buildFlightBoardRows([base], ZONE, NOW)[0].deadline_moved).toBe(false);
  });
});

describe("buildFlightBoardAlerts", () => {
  it("should make an early banner and a delayed banner with what is stored", () => {
    const rows = buildFlightBoardRows(
      [flight(), flight({ id: "f2", flight_number: "EK 215", estimated_arrival_at: "2026-10-24T13:20:00Z", bookings: [{ id: "b2", booking_number: "BK-2", pickup_at: "2026-10-24T14:00:00Z", technician_jobs: [{ job_type: "installation", status: "assigned", deadline_at: "2026-10-24T14:20:00Z" }] }] })],
      ZONE,
      NOW,
    );

    expect(buildFlightBoardAlerts(rows, ZONE)).toEqual([
      {
        key: "f1:b1",
        kind: "early",
        title: "ARRIVING 45 MINUTES EARLY",
        detail: "EK 203 · Estimated 15:45 GST · Installation deadline moved to 14:45 GST · Asia/Dubai.",
      },
      {
        key: "f2:b2",
        kind: "delayed",
        title: "DELAYED 50 MINUTES, DEADLINE MOVED",
        detail: "EK 215 · Estimated 17:20 GST · Installation deadline moved to 18:20 GST · Asia/Dubai.",
      },
    ]);
  });

  it("should not say who was notified, because that is not stored", () => {
    const alerts = buildFlightBoardAlerts(buildFlightBoardRows([flight()], ZONE, NOW), ZONE);

    expect(alerts[0].detail).not.toMatch(/notified/i);
  });

  it("should make no banner for on time, cancelled or an empty list", () => {
    const rows = buildFlightBoardRows([at("2026-10-24T12:30:00Z"), flight({ id: "f3", status: "cancelled" })], ZONE, NOW);

    expect(buildFlightBoardAlerts(rows, ZONE)).toEqual([]);
    expect(buildFlightBoardAlerts([], ZONE)).toEqual([]);
  });
});

describe("getTodayInZone", () => {
  it("should give the calendar day at the airport, not in UTC", () => {
    expect(getTodayInZone(new Date("2026-10-24T21:00:00Z"), "Asia/Dubai")).toBe("2026-10-25");
    expect(getTodayInZone(new Date("2026-10-24T21:00:00Z"), "UTC")).toBe("2026-10-24");
  });
});

describe("formatZoneHeader", () => {
  it("should write the zone, its short name and its offset", () => {
    expect(formatZoneHeader(ZONE, NOW)).toBe("Asia/Dubai (GST, UTC+4)");
  });

  it("should write a half hour offset and a zero offset", () => {
    expect(formatZoneHeader("Asia/Kolkata", NOW)).toContain("UTC+5:30");
    expect(formatZoneHeader("UTC", NOW)).toContain("UTC+0");
  });
});
