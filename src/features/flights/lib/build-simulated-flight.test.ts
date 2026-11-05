import { describe, expect, it } from "vitest";

import { buildSimulatedChange, pickBookingForFlight, pickSimulatedFlight } from "./build-simulated-flight";

const STORED = {
  status: "scheduled" as const,
  scheduled_arrival_at: "2026-12-01T10:00:00Z",
  estimated_arrival_at: "2026-12-01T10:00:00Z",
  actual_arrival_at: null,
  terminal: "T1",
  delay_minutes: 0,
};

describe("buildSimulatedChange (VI-F02-S12)", () => {
  it("should give a negative delay and the changes for a flight that arrives early", () => {
    const { values, changes } = buildSimulatedChange(STORED, {
      estimated_arrival_at: "2026-12-01T09:15:00Z",
      status: "scheduled",
    });

    expect(values.delay_minutes).toBe(-45);
    expect(values.provider).toBe("simulator");
    expect(changes.map((change) => change.field)).toEqual(["estimated_arrival_at", "delay_minutes"]);
  });

  it("should give a positive delay for a delayed flight and keep the terminal", () => {
    const { values } = buildSimulatedChange(STORED, {
      estimated_arrival_at: "2026-12-01T11:30:00Z",
      status: "delayed",
    });

    expect(values).toMatchObject({ status: "delayed", delay_minutes: 90, terminal: "T1", actual_arrival_at: null });
  });

  it("should store the estimate as the actual arrival when the flight has landed", () => {
    const { values } = buildSimulatedChange(STORED, {
      estimated_arrival_at: "2026-12-01T09:40:00Z",
      status: "landed",
    });

    expect(values.actual_arrival_at).toBe("2026-12-01T09:40:00Z");
  });

  it("should report no change when the simulated flight equals the stored one", () => {
    const { changes } = buildSimulatedChange(STORED, {
      estimated_arrival_at: "2026-12-01T10:00:00+00:00",
      status: "scheduled",
    });

    expect(changes).toEqual([]);
  });

  it("should round a delay that is not a whole number of minutes", () => {
    const { values } = buildSimulatedChange(STORED, {
      estimated_arrival_at: "2026-12-01T10:00:40Z",
      status: "scheduled",
    });

    expect(values.delay_minutes).toBe(1);
  });
});

describe("pickSimulatedFlight", () => {
  const now = new Date("2026-12-01T00:00:00Z");

  it("should take the flight whose scheduled arrival is nearest to now", () => {
    const flights = [
      { id: "far", scheduled_arrival_at: "2026-12-20T10:00:00Z" },
      { id: "near", scheduled_arrival_at: "2026-12-02T10:00:00Z" },
      { id: "past", scheduled_arrival_at: "2026-11-01T10:00:00Z" },
    ];

    expect(pickSimulatedFlight(flights, now)?.id).toBe("near");
  });

  it("should take the earlier flight when two are equally near", () => {
    const flights = [
      { id: "later", scheduled_arrival_at: "2026-12-02T00:00:00Z" },
      { id: "earlier", scheduled_arrival_at: "2026-11-30T00:00:00Z" },
    ];

    expect(pickSimulatedFlight(flights, now)?.id).toBe("earlier");
  });

  it("should return null when there is no flight", () => {
    expect(pickSimulatedFlight([], now)).toBeNull();
  });
});

describe("pickBookingForFlight", () => {
  it("should take the booking made first", () => {
    expect(
      pickBookingForFlight([
        { id: "b2", created_at: "2026-11-02T00:00:00Z" },
        { id: "b1", created_at: "2026-11-01T00:00:00Z" },
      ]),
    ).toBe("b1");
  });

  it("should return null when the flight has no booking", () => {
    expect(pickBookingForFlight([])).toBeNull();
  });
});
