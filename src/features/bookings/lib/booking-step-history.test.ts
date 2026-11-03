import { describe, expect, it } from "vitest";

import {
  BOOKING_CREATED_TITLE,
  buildStepHistory,
  formatStepDate,
  formatTimeInStep,
  minutesInStep,
} from "@/features/bookings/lib/booking-step-history";
import type { BookingEventItem } from "@/features/bookings/lib/get-booking-events";

const event = (overrides: Partial<BookingEventItem>): BookingEventItem => ({
  id: "e",
  from_status: null,
  to_status: "pending",
  notes: null,
  created_at: "2026-10-24T08:08:00Z",
  event_type: "created",
  actor_name: null,
  from_seat_serial: null,
  to_seat_serial: null,
  changes: null,
  ...overrides,
});

describe("buildStepHistory (CO-F08-S06 AC02, AC04)", () => {
  it("should name each step the booking moved to, with the actor, the time and the note", () => {
    const rows = buildStepHistory([
      event({
        id: "e2",
        event_type: "status_changed",
        from_status: "pending",
        to_status: "confirmed",
        actor_name: "Lucas Meyer",
        notes: "Booking verified",
        created_at: "2026-10-24T08:10:00Z",
      }),
      event({ id: "e1", actor_name: "Emirates Rent A Car" }),
    ]);

    expect(rows).toEqual([
      {
        id: "e2",
        title: "Allocated",
        actor_name: "Lucas Meyer",
        notes: "Booking verified",
        created_at: "2026-10-24T08:10:00Z",
      },
      {
        id: "e1",
        title: BOOKING_CREATED_TITLE,
        actor_name: "Emirates Rent A Car",
        notes: null,
        created_at: "2026-10-24T08:08:00Z",
      },
    ]);
  });

  it("should keep the order it is given, newest first", () => {
    const rows = buildStepHistory([
      event({ id: "c", event_type: "status_changed", to_status: "assigned" }),
      event({ id: "b", event_type: "status_changed", to_status: "confirmed" }),
      event({ id: "a" }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(["c", "b", "a"]);
  });

  it("should leave out edits and seat changes, which are not steps", () => {
    const rows = buildStepHistory([
      event({ id: "u", event_type: "updated" }),
      event({ id: "s", event_type: "seat_changed" }),
      event({ id: "x", event_type: null }),
    ]);

    expect(rows).toEqual([]);
  });

  it("should keep the actor empty when the actor is hidden, so the screen can say who is unknown", () => {
    const [row] = buildStepHistory([event({ event_type: "status_changed", to_status: "confirmed", actor_name: null })]);

    expect(row?.actor_name).toBeNull();
  });
});

describe("minutesInStep", () => {
  const history = buildStepHistory([event({ event_type: "status_changed", to_status: "assigned", created_at: "2026-10-24T13:05:00Z" })]);

  it("should count the whole minutes since the newest step began", () => {
    expect(minutesInStep(history, new Date("2026-10-24T15:15:30Z"))).toBe(130);
  });

  it("should not go below zero when the clock is behind the event", () => {
    expect(minutesInStep(history, new Date("2026-10-24T12:00:00Z"))).toBe(0);
  });

  it("should give nothing when there is no event", () => {
    expect(minutesInStep([], new Date("2026-10-24T12:00:00Z"))).toBeNull();
  });
});

describe("formatTimeInStep", () => {
  it.each([
    [0, "0 min"],
    [45, "45 min"],
    [120, "2 h"],
    [130, "2 h 10 min"],
  ])("should write %i minutes as %s", (minutes, text) => {
    expect(formatTimeInStep(minutes)).toBe(text);
  });
});

describe("formatStepDate", () => {
  it("should show the day in the timezone of the airport, not in UTC", () => {
    expect(formatStepDate("2026-10-23T21:30:00Z", "Asia/Dubai")).toBe("24 Oct 2026");
    expect(formatStepDate("2026-10-23T21:30:00Z", "UTC")).toBe("23 Oct 2026");
  });
});
