import { describe, expect, it } from "vitest";

import {
  buildOverviewGroups,
  buildOverviewSteps,
  formatMinutesInStep,
  formatOverviewDateTime,
} from "@/features/bookings/lib/booking-overview";
import type { BookingDetailItem } from "@/features/bookings/lib/get-bookings";

const booking = {
  status: "family_ready",
  partner: { name: "ERAC" },
  airport: { code: "DXB" },
  flight: { terminal: "3" },
  vehicle_bay: "C-14",
  vehicle: "Toyota RAV4",
  child_height: 92,
  child_age_band: "24-48 months",
  category: { name: "Convertible" },
  seat: null,
  technician: null,
  external_booking_number: null,
  pickup_at: "2026-10-24T12:30:00.000Z",
  return_at: null,
  daily_rate: 75,
} as unknown as BookingDetailItem;

describe("buildOverviewGroups", () => {
  const rows = (title: string) => buildOverviewGroups(booking, "Asia/Dubai", 24).find((g) => g.title === title)!.rows;

  it("should show the pickup with the airport time zone and a dash for a missing return", () => {
    expect(rows("Pickup and return")[0].value).toBe("24 Oct 2026 · 16:30 GST · Asia/Dubai");
    expect(rows("Pickup and return")[1].value).toBe("-");
  });

  it("should build the location from the airport, terminal and bay", () => {
    expect(rows("Pickup and return")[2].value).toBe("DXB · Terminal 3 · Bay C-14");
  });

  it("should show the child height in cm and the step with its time", () => {
    expect(rows("Child")[1].value).toBe("92 cm");
    expect(rows("Booking information")[3].value).toBe("Family Ready · 24 minutes");
  });
});

describe("buildOverviewSteps", () => {
  it("should mark the steps before the current one as done and the ones after as upcoming", () => {
    const steps = buildOverviewSteps("ready");

    expect(steps).toHaveLength(13);
    expect(steps.map((s) => s.state).filter((s) => s === "current")).toHaveLength(1);
    expect(steps[0].state).toBe("done");
    expect(steps[12].state).toBe("upcoming");
  });

  it("should mark no step as current for a cancelled booking", () => {
    expect(buildOverviewSteps("cancelled").every((s) => s.state === "upcoming")).toBe(true);
  });
});

describe("formatMinutesInStep", () => {
  it.each([
    [1, "1 minute"],
    [24, "24 minutes"],
    [130, "2 h 10 min"],
  ])("should write %i minutes as %s", (minutes, text) => {
    expect(formatMinutesInStep(minutes)).toBe(text);
  });
});

describe("formatOverviewDateTime", () => {
  it("should give a dash when the time is not stored", () => {
    expect(formatOverviewDateTime(null, "Asia/Dubai")).toBe("-");
  });
});
