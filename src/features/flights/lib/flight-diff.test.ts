import { describe, expect, it } from "vitest";

import { diffFlight, toHistorySource, type StoredFlightValues } from "./flight-diff";

const STORED: StoredFlightValues = {
  status: "scheduled",
  estimated_arrival_at: "2026-10-24T12:30:00.000Z",
  actual_arrival_at: null,
  terminal: "3",
  delay_minutes: null,
};

describe("diffFlight (VI-F02-S03-AC02)", () => {
  it("should list the field that changed with its old and new value", () => {
    const changes = diffFlight(STORED, { ...STORED, estimated_arrival_at: "2026-10-24T11:45:00.000Z" });

    expect(changes).toEqual([
      {
        field: "estimated_arrival_at",
        from: "2026-10-24T12:30:00.000Z",
        to: "2026-10-24T11:45:00.000Z",
      },
    ]);
  });

  it("should list every field that changed, in a fixed order", () => {
    const changes = diffFlight(STORED, {
      ...STORED,
      status: "delayed",
      terminal: "1",
      delay_minutes: 40,
    });

    expect(changes.map((change) => change.field)).toEqual(["status", "terminal", "delay_minutes"]);
  });

  it("should list nothing when the source says what is stored", () => {
    expect(diffFlight(STORED, { ...STORED })).toEqual([]);
  });

  it("should not call the same instant written in another way a change", () => {
    const changes = diffFlight(STORED, { ...STORED, estimated_arrival_at: "2026-10-24T14:30:00+02:00" });

    expect(changes).toEqual([]);
  });

  it("should record a value that appears, such as the actual arrival of a landed flight", () => {
    const changes = diffFlight(STORED, {
      ...STORED,
      status: "landed",
      actual_arrival_at: "2026-10-24T12:41:00.000Z",
    });

    expect(changes).toEqual([
      { field: "status", from: "scheduled", to: "landed" },
      { field: "actual_arrival_at", from: null, to: "2026-10-24T12:41:00.000Z" },
    ]);
  });

  it("should record a value that goes away", () => {
    expect(diffFlight(STORED, { ...STORED, terminal: null })).toEqual([
      { field: "terminal", from: "3", to: null },
    ]);
  });
});

describe("toHistorySource", () => {
  it("should name the live provider as the provider", () => {
    expect(toHistorySource("provider")).toBe("provider");
  });

  it("should name the sandbox data and the simulator as the system", () => {
    expect(toHistorySource("sandbox")).toBe("system");
    expect(toHistorySource("simulator")).toBe("system");
  });
});
