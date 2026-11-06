import { describe, expect, it } from "vitest";

import { buildSimulatorImpact, type SimulatorFlightPreview } from "@/features/flights/lib/simulator-impact";

// Scheduled 16:30 in Dubai (UTC+4) is 12:30 UTC. The pickup is 16:15 in Dubai, so the base deadline is 15:15 in Dubai.
// The deadline stored now is 15:30 in Dubai.
const PREVIEW: SimulatorFlightPreview = {
  flight_number: "EK203",
  airport_code: "DXB",
  airport_name: "Dubai International Airport",
  time_zone: "Asia/Dubai",
  scheduled_arrival_at: "2026-10-24T12:30:00Z",
  booking: { pickup_at: "2026-10-24T12:15:00Z", installation_deadline_at: "2026-10-24T11:30:00Z" },
};

const impact = (estimated_arrival_at: string, status = "scheduled", preview: SimulatorFlightPreview | null = PREVIEW) =>
  buildSimulatorImpact({ preview, estimated_arrival_at, status });

describe("buildSimulatorImpact (VI-F02-T02)", () => {
  it("should say early 45 min, high priority and a deadline 45 minutes before the base one, next to the stored one", () => {
    // 15:45 in Dubai is 45 minutes before the schedule.
    expect(impact("2026-10-24T15:45")).toEqual({
      change: "Early 45 min",
      priority: "High",
      new_deadline: "14:30 GST",
      previous_deadline: "15:30 GST",
    });
  });

  it("should say delayed, keep the priority normal and move the deadline later by the delay", () => {
    // 17:20 in Dubai is 50 minutes after the schedule.
    expect(impact("2026-10-24T17:20")).toEqual({
      change: "Delayed 50 min",
      priority: "Normal",
      new_deadline: "16:05 GST",
      previous_deadline: "15:30 GST",
    });
  });

  it("should say on time and keep the base deadline when the gap is under 15 minutes", () => {
    expect(impact("2026-10-24T16:40")).toMatchObject({ change: "On time", priority: "Normal", new_deadline: "15:15 GST" });
    expect(impact("2026-10-24T16:16")).toMatchObject({ change: "On time", new_deadline: "15:15 GST" });
  });

  it("should move the deadline and raise the priority at exactly 15 minutes early, and not at 14", () => {
    expect(impact("2026-10-24T16:15")).toMatchObject({ change: "Early 15 min", priority: "High", new_deadline: "15:00 GST" });
    expect(impact("2026-10-24T16:16")).toMatchObject({ priority: "Normal", new_deadline: "15:15 GST" });
  });

  it("should move the deadline at exactly 15 minutes late", () => {
    expect(impact("2026-10-24T16:45")).toMatchObject({ change: "Delayed 15 min", new_deadline: "15:30 GST" });
  });

  it("should say cancelled or diverted for that status and keep the priority normal", () => {
    expect(impact("2026-10-24T15:45", "cancelled")).toMatchObject({ change: "Cancelled", priority: "Normal" });
    expect(impact("2026-10-24T15:45", "diverted")).toMatchObject({ change: "Diverted", priority: "Normal" });
  });

  it("should show a dash for everything when no flight was found", () => {
    expect(impact("2026-10-24T15:45", "scheduled", null)).toEqual({
      change: "-",
      priority: "-",
      new_deadline: "-",
      previous_deadline: "-",
    });
  });

  it("should keep the stored deadline and show a dash for the rest when the estimated arrival is empty or not valid", () => {
    for (const estimated of ["", "soon", "2026-13-01T09:30"]) {
      expect(impact(estimated)).toEqual({
        change: "-",
        priority: "-",
        new_deadline: "-",
        previous_deadline: "15:30 GST",
      });
    }
  });

  it("should show a dash for the deadlines when no booking is open or the booking has no stored deadline", () => {
    const none = { ...PREVIEW, booking: null };
    const unset = { ...PREVIEW, booking: { pickup_at: "2026-10-24T12:15:00Z", installation_deadline_at: null } };

    expect(impact("2026-10-24T15:45", "scheduled", none)).toMatchObject({ new_deadline: "-", previous_deadline: "-" });
    expect(impact("2026-10-24T15:45", "scheduled", unset)).toMatchObject({ new_deadline: "14:30 GST", previous_deadline: "-" });
  });
});
