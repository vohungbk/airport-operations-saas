import { describe, expect, it } from "vitest";

import {
  TIMELINE_FILTERS,
  filterTimelineEntries,
  formatTimelineTime,
  type TimelineEntry,
} from "@/features/bookings/lib/booking-timeline";
import { buildTimelineEntries } from "@/features/bookings/lib/build-timeline-entries";
import type { BookingAdjustmentRow } from "@/features/bookings/lib/get-booking-adjustments";
import type { BookingEventItem } from "@/features/bookings/lib/get-booking-events";
import type { FlightUpdateItem } from "@/features/flights/schemas/flight-update.schema";

const event = (
  id: string,
  event_type: BookingEventItem["event_type"],
  created_at: string,
) => ({ id, event_type, created_at }) as BookingEventItem;

const adjustment = (id: string, created_at: string) =>
  ({
    id,
    type: "partial_refund",
    amount: 20,
    reason: "Early return refund",
    created_at,
    creator: { full_name: "Omar Haddad" },
  }) as BookingAdjustmentRow;

const flightUpdate: FlightUpdateItem = {
  id: "u-1",
  source: "provider",
  occurred_at: "2026-10-24T11:00:00.000Z",
  changes: [{ field: "delay_minutes", from: null, to: 40 }],
};

const build = (over: Partial<Parameters<typeof buildTimelineEntries>[0]> = {}) =>
  buildTimelineEntries({
    events: [
      event("e-1", "created", "2026-10-24T10:00:00.000Z"),
      event("e-2", "updated", "2026-10-24T12:00:00.000Z"),
    ],
    adjustments: [adjustment("a-1", "2026-10-24T13:00:00.000Z")],
    flightUpdates: [flightUpdate],
    timeZone: "Asia/Dubai",
    ...over,
  });

describe("booking timeline filters", () => {
  it("should list the chips in the order of the design", () => {
    expect(TIMELINE_FILTERS.map((item) => item.label)).toEqual([
      "All",
      "Status",
      "Flight",
      "Money",
      "Photos",
    ]);
  });

  it("should keep every entry for All", () => {
    expect(filterTimelineEntries(build(), "all")).toHaveLength(4);
  });

  it("should keep only the entries of the chosen type", () => {
    const entries = build();

    expect(filterTimelineEntries(entries, "status").map((e) => e.id)).toEqual([
      "event-e-1",
    ]);
    expect(filterTimelineEntries(entries, "flight").map((e) => e.id)).toEqual([
      "flight-u-1",
    ]);
    expect(filterTimelineEntries(entries, "money").map((e) => e.id)).toEqual([
      "adjustment-a-1",
    ]);
  });

  it("should return nothing for Photos, which are not recorded yet", () => {
    expect(filterTimelineEntries(build(), "photos")).toEqual([]);
  });

  it("should return an empty list when there are no entries", () => {
    expect(filterTimelineEntries([], "all")).toEqual([]);
  });
});

describe("buildTimelineEntries", () => {
  it("should order the entries newest first across the three sources", () => {
    expect(build().map((entry) => entry.id)).toEqual([
      "adjustment-a-1",
      "event-e-2",
      "flight-u-1",
      "event-e-1",
    ]);
  });

  it("should write an adjustment with its type, signed amount, reason and who recorded it", () => {
    const entry = build().find((e) => e.id === "adjustment-a-1") as Extract<
      TimelineEntry,
      { kind: "text" }
    >;

    expect(entry.title).toBe("Adjustment added");
    expect(entry.actor).toBe("Omar Haddad");
    expect(entry.lines).toEqual(["Refund · -USD 20.00"]);
    expect(entry.reason).toBe("Early return refund");
  });

  it("should write a flight update with its source and what changed", () => {
    const entry = build().find((e) => e.id === "flight-u-1") as Extract<
      TimelineEntry,
      { kind: "text" }
    >;

    expect(entry.title).toBe("Flight updated");
    expect(entry.actor).toBe("Provider");
    expect(entry.lines).toEqual(["Delay updated to 40 min"]);
  });

  it("should leave out the money entries for a role that does not see adjustments", () => {
    expect(
      build({ adjustments: null }).some((e) => e.category === "money"),
    ).toBe(false);
  });

  it("should leave out the flight entries when the booking has no flight", () => {
    expect(
      build({ flightUpdates: null }).some((e) => e.category === "flight"),
    ).toBe(false);
  });
});

describe("formatTimelineTime", () => {
  it("should add the airport time zone after the time", () => {
    expect(formatTimelineTime("24 Oct 2026, 16:45", "Asia/Dubai")).toBe(
      "24 Oct 2026, 16:45 · Asia/Dubai",
    );
  });
});
