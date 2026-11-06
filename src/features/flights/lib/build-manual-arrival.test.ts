import { describe, expect, it } from "vitest";

import { buildManualArrival } from "@/features/flights/lib/build-manual-arrival";

const SCHEDULED = "2026-12-01T10:00:00Z";
const STORED = {
  status: "scheduled" as const,
  estimated_arrival_at: "2026-12-01T10:00:00Z",
  actual_arrival_at: null,
  terminal: "T1",
  delay_minutes: 0,
};

describe("buildManualArrival (VI-F02-S07)", () => {
  it("should store the arrival as the estimate and work out the delay against the schedule", () => {
    const { values, changes } = buildManualArrival(STORED, SCHEDULED, "2026-12-01T11:20:00.000Z");

    expect(values).toEqual({
      status: "scheduled",
      estimated_arrival_at: "2026-12-01T11:20:00.000Z",
      actual_arrival_at: null,
      terminal: "T1",
      delay_minutes: 80,
      provider: "manual",
    });
    expect(changes).toEqual([
      { field: "estimated_arrival_at", from: "2026-12-01T10:00:00Z", to: "2026-12-01T11:20:00.000Z" },
      { field: "delay_minutes", from: 0, to: 80 },
    ]);
  });

  it("should give a negative delay for an arrival before the schedule", () => {
    expect(buildManualArrival(STORED, SCHEDULED, "2026-12-01T09:15:00.000Z").values.delay_minutes).toBe(-45);
  });

  it("should keep the status, the actual arrival and the terminal", () => {
    const { values } = buildManualArrival(
      { ...STORED, status: "landed", actual_arrival_at: "2026-12-01T10:05:00Z" },
      SCHEDULED,
      "2026-12-01T10:30:00.000Z",
    );

    expect(values).toMatchObject({ status: "landed", actual_arrival_at: "2026-12-01T10:05:00Z", terminal: "T1" });
  });

  it("should give no change when the arrival is the one already stored", () => {
    expect(buildManualArrival(STORED, SCHEDULED, "2026-12-01T10:00:00.000Z").changes).toEqual([]);
  });

  it("should start a new flight as scheduled with no terminal", () => {
    const { values, changes } = buildManualArrival(null, SCHEDULED, "2026-12-01T10:50:00.000Z");

    expect(values).toMatchObject({ status: "scheduled", terminal: null, actual_arrival_at: null, delay_minutes: 50 });
    expect(changes.map((change) => change.field)).toEqual(["estimated_arrival_at", "delay_minutes"]);
  });
});
