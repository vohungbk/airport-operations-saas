import { describe, expect, it } from "vitest";

import {
  classifyFlight,
  formatAge,
  getDataAgeMinutes,
  getFlightOffsetMinutes,
  isStale,
  type FlightTimes,
} from "@/lib/flights/flight-timing";

const flight = (over: Partial<FlightTimes> = {}): FlightTimes => ({
  scheduled_arrival_at: "2026-11-24T10:00:00Z",
  estimated_arrival_at: null,
  actual_arrival_at: null,
  delay_minutes: null,
  ...over,
});

describe("getFlightOffsetMinutes", () => {
  it("should be late by the gap between estimated and scheduled arrival", () => {
    expect(getFlightOffsetMinutes(flight({ estimated_arrival_at: "2026-11-24T10:50:00Z" }))).toBe(50);
  });

  it("should be early, as a negative number, when the estimate is before the schedule", () => {
    expect(getFlightOffsetMinutes(flight({ estimated_arrival_at: "2026-11-24T09:15:00Z" }))).toBe(-45);
  });

  it("should prefer the actual arrival over the estimate", () => {
    expect(
      getFlightOffsetMinutes(
        flight({ estimated_arrival_at: "2026-11-24T10:50:00Z", actual_arrival_at: "2026-11-24T10:05:00Z" }),
      ),
    ).toBe(5);
  });

  it("should count across midnight", () => {
    expect(
      getFlightOffsetMinutes(
        flight({ scheduled_arrival_at: "2026-11-24T23:50:00Z", estimated_arrival_at: "2026-11-25T00:20:00Z" }),
      ),
    ).toBe(30);
  });

  it("should use the stored delay when there is no estimate", () => {
    expect(getFlightOffsetMinutes(flight({ delay_minutes: 20 }))).toBe(20);
  });

  it("should not guess when there is neither an estimate nor a stored delay", () => {
    expect(getFlightOffsetMinutes(flight())).toBeNull();
  });

  it("should not guess when a time is not a date", () => {
    expect(getFlightOffsetMinutes(flight({ estimated_arrival_at: "soon" }))).toBeNull();
  });
});

describe("classifyFlight", () => {
  it.each([
    [50, "delayed"],
    [15, "delayed"],
    [14, "on_time"],
    [0, "on_time"],
    [-14, "on_time"],
    [-15, "early"],
    [-45, "early"],
  ])("should call an offset of %i minutes %s", (offset, expected) => {
    expect(classifyFlight(offset)).toBe(expected);
  });

  it("should be unknown when the offset is unknown", () => {
    expect(classifyFlight(null)).toBe("unknown");
  });

  it("should use the threshold it is given", () => {
    expect(classifyFlight(10, 5)).toBe("delayed");
  });
});

describe("data age", () => {
  const now = new Date("2026-11-24T12:00:00Z");

  it("should count whole minutes since the last sync", () => {
    expect(getDataAgeMinutes("2026-11-24T11:15:30Z", now)).toBe(44);
  });

  it("should be null when it never synced", () => {
    expect(getDataAgeMinutes(null, now)).toBeNull();
  });

  it("should not go below zero when the sync is in the future", () => {
    expect(getDataAgeMinutes("2026-11-24T12:05:00Z", now)).toBe(0);
  });

  it("should call data that never synced stale", () => {
    expect(isStale(null)).toBe(true);
  });

  it("should call data stale only after the limit", () => {
    expect(isStale(30)).toBe(false);
    expect(isStale(31)).toBe(true);
  });

  it.each([
    [null, "never updated"],
    [0, "just now"],
    [12, "12 min ago"],
    [120, "2 h ago"],
    [3000, "2 d ago"],
  ])("should write an age of %s as %s", (age, text) => {
    expect(formatAge(age)).toBe(text);
  });
});
