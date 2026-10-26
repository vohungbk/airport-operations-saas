import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FlightAlert } from "@/components/domain/flight-alert";
import { FlightStatusCard, type FlightStatusCardFlight } from "@/components/domain/flight-status-card";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
const now = new Date("2026-11-24T12:00:00Z");
const formatTime = (iso: string) => `T(${iso})`;

const flight = (over: Partial<FlightStatusCardFlight> = {}): FlightStatusCardFlight => ({
  flight_number: "VN123",
  status: "scheduled",
  terminal: "T2",
  scheduled_arrival_at: "2026-11-24T10:00:00Z",
  estimated_arrival_at: null,
  actual_arrival_at: null,
  delay_minutes: null,
  last_synced_at: "2026-11-24T11:55:00Z",
  ...over,
});
const card = (f: FlightStatusCardFlight, extra: object = {}) =>
  html(createElement(FlightStatusCard, { flight: f, formatTime, now, ...extra }));

describe("FlightAlert", () => {
  it("should say the flight arrives early, with an icon and text", () => {
    const out = html(createElement(FlightAlert, { kind: "early", minutes: 45 }));
    expect(out).toContain("ARRIVING 45 MINUTES EARLY");
    expect(out).toContain("<svg");
    expect(out).toContain('data-kind="early"');
  });

  it("should say the flight is delayed", () => {
    expect(html(createElement(FlightAlert, { kind: "delayed", minutes: 50 }))).toContain("DELAYED 50 MINUTES");
  });

  it("should say the deadline moved only when the new deadline is given", () => {
    const without = html(createElement(FlightAlert, { kind: "delayed", minutes: 50 }));
    const withDeadline = html(createElement(FlightAlert, { kind: "delayed", minutes: 50, deadlineMovedTo: "12:30" }));
    expect(without).not.toContain("DEADLINE MOVED");
    expect(withDeadline).toContain("DEADLINE MOVED");
    expect(withDeadline).toContain("12:30");
  });

  it("should write one minute in the singular", () => {
    expect(html(createElement(FlightAlert, { kind: "delayed", minutes: 1 }))).toContain("DELAYED 1 MINUTE");
  });

  it("should be announced as an alert", () => {
    expect(html(createElement(FlightAlert, { kind: "early", minutes: 20 }))).toContain('role="alert"');
  });
});

describe("FlightStatusCard", () => {
  it("should show the flight, terminal, scheduled time and status", () => {
    const out = card(flight());
    expect(out).toContain("VN123");
    expect(out).toContain("T2");
    expect(out).toContain("T(2026-11-24T10:00:00Z)");
    expect(out).toContain("Scheduled");
  });

  it("should show the delayed alert for a flight 50 minutes late", () => {
    const out = card(flight({ status: "delayed", estimated_arrival_at: "2026-11-24T10:50:00Z" }));
    expect(out).toContain("DELAYED 50 MINUTES");
  });

  it("should show the early alert for a flight 45 minutes early", () => {
    const out = card(flight({ estimated_arrival_at: "2026-11-24T09:15:00Z" }));
    expect(out).toContain("ARRIVING 45 MINUTES EARLY");
  });

  it("should show its age and no stale warning for fresh data", () => {
    const out = card(flight());
    expect(out).toContain("5 min ago");
    expect(out).not.toContain('data-slot="flight-stale"');
  });

  it("should show its age and a stale warning when the data is old", () => {
    const out = card(flight({ last_synced_at: "2026-11-24T10:00:00Z" }));
    expect(out).toContain("2 h ago");
    expect(out).toContain('data-slot="flight-stale"');
    expect(out).toContain("Times may be wrong");
    expect(out).toContain('data-stale="true"');
  });

  it("should warn that data that never synced was never updated", () => {
    const out = card(flight({ last_synced_at: null }));
    expect(out).toContain("never updated");
    expect(out).toContain('data-slot="flight-stale"');
  });

  it("should show no alert for a flight on time", () => {
    expect(card(flight({ estimated_arrival_at: "2026-11-24T10:05:00Z" }))).not.toContain('data-slot="flight-alert"');
  });

  it("should show no alert when it cannot tell how early or late the flight is", () => {
    expect(card(flight())).not.toContain('data-slot="flight-alert"');
  });

  it("should show no early or late alert for a cancelled flight", () => {
    const out = card(flight({ status: "cancelled", estimated_arrival_at: "2026-11-24T11:30:00Z" }));
    expect(out).not.toContain('data-slot="flight-alert"');
  });

  it("should show a dash, not a made-up value, for an absent estimate or terminal", () => {
    const out = card(flight({ terminal: null }));
    expect(out).toContain(">-<");
    expect(out).not.toContain("null");
  });

  it("should cut a very long flight number and keep it whole in the title", () => {
    const number = "VN" + "9".repeat(60);
    const out = card(flight({ flight_number: number }));
    expect(out).toContain("truncate");
    expect(out).toContain(`title="${number}"`);
  });

  it("should use the alert threshold it is given", () => {
    const out = card(flight({ estimated_arrival_at: "2026-11-24T10:10:00Z" }), { alertThresholdMinutes: 5 });
    expect(out).toContain("DELAYED 10 MINUTES");
  });
});
