import { describe, expect, it } from "vitest";

import {
  buildFlightAlertMark,
  buildTimeInStepLabel,
} from "@/features/workflow-board/lib/board-card";

const flight = (estimated: string | null, delay: number | null = null) => ({
  scheduled_arrival_at: "2026-10-24T11:00:00Z",
  estimated_arrival_at: estimated,
  actual_arrival_at: null,
  delay_minutes: delay,
});

describe("buildFlightAlertMark (AC04)", () => {
  it("should say Delayed with the minutes when the flight is late by the threshold or more", () => {
    expect(buildFlightAlertMark(flight("2026-10-24T11:50:00Z"))).toEqual({
      kind: "delayed",
      minutes: 50,
      label: "Delayed 50 min",
    });
  });

  it("should say Early with a positive number of minutes when the flight is early", () => {
    expect(buildFlightAlertMark(flight("2026-10-24T10:15:00Z"))).toEqual({
      kind: "early",
      minutes: 45,
      label: "Early 45 min",
    });
  });

  it("should give no mark for a flight less than 15 minutes off", () => {
    expect(buildFlightAlertMark(flight("2026-10-24T11:10:00Z"))).toBeNull();
  });

  it("should use the stored delay when there is no estimate", () => {
    expect(buildFlightAlertMark(flight(null, 30))?.label).toBe("Delayed 30 min");
  });

  it("should give no mark when there is no flight or no way to tell", () => {
    expect(buildFlightAlertMark(null)).toBeNull();
    expect(buildFlightAlertMark(flight(null, null))).toBeNull();
  });
});

describe("buildTimeInStepLabel (AC03)", () => {
  const NOW = new Date("2026-10-23T12:00:00Z");

  it("should say how long the booking has been in its step", () => {
    expect(buildTimeInStepLabel("2026-10-23T09:50:00Z", NOW)).toBe("In step 2 h 10 min");
  });

  it("should not go below zero when the clock of the event is ahead", () => {
    expect(buildTimeInStepLabel("2026-10-23T12:05:00Z", NOW)).toBe("In step 0 min");
  });

  it("should give none when no event says when the step began", () => {
    expect(buildTimeInStepLabel(null, NOW)).toBeNull();
  });
});

describe("buildFlightAlertMark cancelled or diverted (VI-F02-S06)", () => {
  it("should flag a cancelled flight and a diverted flight by name", () => {
    expect(buildFlightAlertMark({ ...flight(null), status: "cancelled" })).toEqual({
      kind: "cancelled",
      minutes: 0,
      label: "Flight cancelled",
    });
    expect(buildFlightAlertMark({ ...flight(null), status: "diverted" })?.label).toBe("Flight diverted");
  });

  it("should not read the old estimate of a cancelled flight as early", () => {
    const mark = buildFlightAlertMark({ ...flight("2026-10-24T10:15:00Z"), status: "cancelled" });

    expect(mark?.kind).toBe("cancelled");
  });

  it("should keep the early mark for a flight that is not cancelled or diverted", () => {
    expect(buildFlightAlertMark({ ...flight("2026-10-24T10:15:00Z"), status: "scheduled" })?.kind).toBe("early");
  });
});
