import { describe, expect, it } from "vitest";

import { buildCleaningPanelView } from "@/features/cleaning/lib/build-cleaning-panel-view";
import type { SeatStatus } from "@/features/seats/types";
import type { CleaningRecord } from "@/features/cleaning/lib/get-cleaning-context";

const SEAT: { serial_number: string; status: SeatStatus; quarantine_reason: string | null } = {
  serial_number: "SEAT-0001",
  status: "cleaning",
  quarantine_reason: null,
};
const NOW = new Date("2026-11-04T07:18:00Z");

function record(overrides: Partial<CleaningRecord> = {}): CleaningRecord {
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

function build(state: Parameters<typeof buildCleaningPanelView>[0]["state"], cleaning: CleaningRecord | null, seat = SEAT) {
  return buildCleaningPanelView({
    state,
    jobId: "j-1",
    seat,
    cleaning,
    conflict: null,
    lastCleaning: null,
    timeZone: "Asia/Dubai",
    now: NOW,
  });
}

describe("buildCleaningPanelView", () => {
  it("should say who started, when, and the elapsed time while in progress", () => {
    const view = build("in_progress", record());

    expect(view.startedLine).toBe("Started by Omar Haddad at 04 Nov 2026 11:00 GST. Elapsed 18 min.");
  });

  it("should show the Quarantine reason and who recorded a failed cleaning", () => {
    const view = build(
      "failed",
      record({ completed_at: "2026-11-04T07:18:00Z", passed: false }),
      { ...SEAT, status: "quarantine", quarantine_reason: "persistent contamination on harness" },
    );

    expect(view.failedLine).toBe("Result: Failed. Quarantine reason: persistent contamination on harness.");
    expect(view.recordedLine).toBe("Recorded by Omar Haddad · 04 Nov 2026 11:18 GST");
  });

  it("should give the booking number and period of the booking that blocks the start", () => {
    const view = buildCleaningPanelView({
      state: "blocked",
      jobId: "j-1",
      seat: { ...SEAT, status: "reserved" },
      cleaning: null,
      conflict: {
        id: "b-9",
        booking_number: "BK-2026-000123",
        pickup_at: "2026-11-04T05:00:00Z",
        return_at: "2026-11-04T13:00:00Z",
      },
      lastCleaning: { at: "2026-11-03T13:20:00Z", outcome: "Success" },
      timeZone: "Asia/Dubai",
      now: NOW,
    });

    expect(view.conflict).toEqual({
      bookingId: "b-9",
      bookingNumber: "BK-2026-000123",
      period: "04 Nov 2026 09:00 GST - 04 Nov 2026 17:00 GST",
    });
    expect(view.lastCleaning).toBe("03 Nov 2026 17:20 GST · Success");
  });

  it("should leave the lines of other states empty", () => {
    const view = build("not_started", null);

    expect(view).toMatchObject({
      startedLine: null,
      completedLine: null,
      failedLine: null,
      recordedLine: null,
      conflict: null,
    });
  });
});
