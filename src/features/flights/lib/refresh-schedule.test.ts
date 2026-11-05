import { describe, expect, it } from "vitest";

import {
  getRefreshIntervalMinutes,
  isRefreshDue,
  isRefreshFinal,
  type RefreshableFlight,
} from "./refresh-schedule";

const NOW = new Date("2026-10-24T10:00:00.000Z");
const HOUR = 60 * 60_000;
const MINUTE = 60_000;

const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();

/** A flight that lands `untilArrivalMs` from now and was last synced `syncedAgoMs` ago (null: never). */
function flight(
  untilArrivalMs: number,
  syncedAgoMs: number | null,
  status = "scheduled",
): RefreshableFlight {
  return {
    status,
    scheduled_arrival_at: at(untilArrivalMs),
    last_synced_at: syncedAgoMs === null ? null : at(-syncedAgoMs),
  };
}

describe("getRefreshIntervalMinutes", () => {
  it("should be 30 minutes between 24 hours and 3 hours before the arrival", () => {
    expect(getRefreshIntervalMinutes(at(12 * HOUR), NOW)).toBe(30);
  });

  it("should be 5 minutes in the last 3 hours", () => {
    expect(getRefreshIntervalMinutes(at(2 * HOUR), NOW)).toBe(5);
  });

  it("should be 5 minutes when the flight is late, past its scheduled arrival", () => {
    expect(getRefreshIntervalMinutes(at(-20 * MINUTE), NOW)).toBe(5);
  });

  it("should be none more than 24 hours before the arrival", () => {
    expect(getRefreshIntervalMinutes(at(25 * HOUR), NOW)).toBeNull();
  });

  it("should switch exactly at 24 hours and at 3 hours", () => {
    expect(getRefreshIntervalMinutes(at(24 * HOUR), NOW)).toBe(30);
    expect(getRefreshIntervalMinutes(at(24 * HOUR + 1), NOW)).toBeNull();
    expect(getRefreshIntervalMinutes(at(3 * HOUR), NOW)).toBe(5);
    expect(getRefreshIntervalMinutes(at(3 * HOUR + 1), NOW)).toBe(30);
  });

  it("should be none when the scheduled arrival is not a date", () => {
    expect(getRefreshIntervalMinutes("not a date", NOW)).toBeNull();
  });
});

describe("isRefreshFinal", () => {
  it("should be true for landed and cancelled only", () => {
    expect(isRefreshFinal("landed")).toBe(true);
    expect(isRefreshFinal("cancelled")).toBe(true);
    expect(isRefreshFinal("scheduled")).toBe(false);
    expect(isRefreshFinal("delayed")).toBe(false);
    expect(isRefreshFinal("diverted")).toBe(false);
  });
});

describe("isRefreshDue (VI-F02-S03-AC01)", () => {
  it("should be due once when a flight 3 days away was never synced", () => {
    expect(isRefreshDue(flight(72 * HOUR, null), NOW)).toBe(true);
  });

  it("should not be due again more than 24 hours before the arrival once it has synced", () => {
    expect(isRefreshDue(flight(72 * HOUR, 10 * HOUR), NOW)).toBe(false);
  });

  it("should be due every 30 minutes from 24 hours before the arrival", () => {
    expect(isRefreshDue(flight(12 * HOUR, 31 * MINUTE), NOW)).toBe(true);
    expect(isRefreshDue(flight(12 * HOUR, 10 * MINUTE), NOW)).toBe(false);
  });

  it("should be due every 5 minutes in the last 3 hours", () => {
    expect(isRefreshDue(flight(2 * HOUR, 6 * MINUTE), NOW)).toBe(true);
    expect(isRefreshDue(flight(2 * HOUR, 2 * MINUTE), NOW)).toBe(false);
  });

  it("should still be due on the next 5 minute beat when the last sync was a few seconds late", () => {
    expect(isRefreshDue(flight(2 * HOUR, 4 * MINUTE + 50_000), NOW)).toBe(true);
  });

  it("should still be due every 5 minutes for a late flight past its scheduled arrival", () => {
    expect(isRefreshDue(flight(-30 * MINUTE, 6 * MINUTE, "delayed"), NOW)).toBe(true);
  });

  it("should not be due when the flight has landed", () => {
    expect(isRefreshDue(flight(-HOUR, 60 * MINUTE, "landed"), NOW)).toBe(false);
  });

  it("should not be due when the flight is cancelled, even if it never synced", () => {
    expect(isRefreshDue(flight(2 * HOUR, null, "cancelled"), NOW)).toBe(false);
  });

  it("should be due when the last sync time is in the future, because it cannot be trusted", () => {
    expect(isRefreshDue(flight(2 * HOUR, -10 * MINUTE), NOW)).toBe(true);
  });

  it("should be due when the last sync time is not a date", () => {
    expect(
      isRefreshDue({ ...flight(2 * HOUR, null), last_synced_at: "not a date" }, NOW),
    ).toBe(true);
  });
});
