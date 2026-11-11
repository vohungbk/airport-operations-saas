import { describe, expect, it } from "vitest";

import {
  getCleaningPanelState,
  getElapsedMinutes,
} from "@/features/cleaning/lib/cleaning-panel-state";
import type { CleaningRecord } from "@/features/cleaning/lib/get-cleaning-context";

function record(overrides: Partial<CleaningRecord>): CleaningRecord {
  return {
    id: "c-1",
    started_at: "2026-11-04T07:00:00Z",
    completed_at: null,
    passed: null,
    notes: null,
    created_at: "2026-11-04T07:00:00Z",
    seat_serial_number: "SEAT-0001",
    recorded_by: "Omar Haddad",
    ...overrides,
  };
}

describe("getCleaningPanelState", () => {
  it.each([
    ["not started", null, false, "not_started"],
    ["not started with a booking conflict", null, true, "blocked"],
    ["started", record({}), false, "in_progress"],
    [
      "completed as passed",
      record({ completed_at: "2026-11-04T07:30:00Z", passed: true }),
      false,
      "completed_passed",
    ],
    [
      "completed as failed",
      record({ completed_at: "2026-11-04T07:30:00Z", passed: false }),
      false,
      "failed",
    ],
  ] as const)("should give the right state when the cleaning is %s", (_name, cleaning, hasBookingConflict, expected) => {
    expect(getCleaningPanelState({ cleaning, hasBookingConflict })).toBe(expected);
  });

  it("should keep the recorded result when a booking now holds the seat", () => {
    const cleaning = record({ completed_at: "2026-11-04T07:30:00Z", passed: false });

    expect(getCleaningPanelState({ cleaning, hasBookingConflict: true })).toBe("failed");
  });
});

describe("getElapsedMinutes", () => {
  it("should count whole minutes since the start", () => {
    expect(getElapsedMinutes("2026-11-04T07:00:00Z", new Date("2026-11-04T07:18:59Z"))).toBe(18);
  });

  it("should not go below zero when the clock is behind", () => {
    expect(getElapsedMinutes("2026-11-04T07:00:00Z", new Date("2026-11-04T06:59:00Z"))).toBe(0);
  });
});
