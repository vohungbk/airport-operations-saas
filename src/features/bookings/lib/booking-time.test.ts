import { describe, expect, it } from "vitest";

import {
  isLocalDateTime,
  utcToZonedLocalInput,
  zonedDayStartToUtcIso,
  zonedLocalToUtcIso,
} from "@/features/bookings/lib/booking-time";

describe("zonedLocalToUtcIso", () => {
  it("should convert Dubai wall-clock time (UTC+4) to UTC", () => {
    expect(zonedLocalToUtcIso("2026-09-01T08:00", "Asia/Dubai")).toBe(
      "2026-09-01T04:00:00.000Z",
    );
  });

  it("should apply daylight saving time in a DST zone", () => {
    expect(zonedLocalToUtcIso("2026-07-01T12:00", "Europe/London")).toBe(
      "2026-07-01T11:00:00.000Z",
    );
    expect(zonedLocalToUtcIso("2026-01-01T12:00", "Europe/London")).toBe(
      "2026-01-01T12:00:00.000Z",
    );
  });

  it("should return null for a malformed value", () => {
    expect(zonedLocalToUtcIso("2026-09-01 08:00", "Asia/Dubai")).toBeNull();
    expect(zonedLocalToUtcIso("2026-02-31T08:00", "Asia/Dubai")).toBeNull();
  });

  it("should return null for an unknown timezone", () => {
    expect(zonedLocalToUtcIso("2026-09-01T08:00", "Not/AZone")).toBeNull();
  });
});

describe("utcToZonedLocalInput", () => {
  it("should round-trip with zonedLocalToUtcIso", () => {
    const iso = zonedLocalToUtcIso("2026-09-01T23:30", "Asia/Dubai")!;

    expect(utcToZonedLocalInput(iso, "Asia/Dubai")).toBe("2026-09-01T23:30");
  });

  it("should cross the date line correctly", () => {
    expect(
      utcToZonedLocalInput("2026-09-01T22:00:00.000Z", "Asia/Dubai"),
    ).toBe("2026-09-02T02:00");
  });
});

describe("zonedDayStartToUtcIso", () => {
  it("should return the start of the day in the airport timezone", () => {
    expect(zonedDayStartToUtcIso("2026-09-05", "Asia/Dubai")).toBe(
      "2026-09-04T20:00:00.000Z",
    );
  });

  it("should return the start of the next day when addDays is 1", () => {
    expect(zonedDayStartToUtcIso("2026-09-30", "Asia/Dubai", 1)).toBe(
      "2026-09-30T20:00:00.000Z",
    );
  });

  it("should return null for a malformed date", () => {
    expect(zonedDayStartToUtcIso("nope", "UTC")).toBeNull();
  });
});

describe("isLocalDateTime", () => {
  it("should reject impossible times", () => {
    expect(isLocalDateTime("2026-09-01T24:00")).toBe(false);
    expect(isLocalDateTime("2026-09-01T08:60")).toBe(false);
    expect(isLocalDateTime("")).toBe(false);
  });
});
