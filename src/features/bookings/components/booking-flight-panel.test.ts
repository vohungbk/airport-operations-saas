import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The manual arrival form refreshes the page after a save; there is no router in a static render.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import {
  BookingFlightPanel,
  getUnlinkedMessage,
} from "@/features/bookings/components/booking-flight-panel";
import type { BookingFlight } from "@/features/bookings/lib/get-bookings";

describe("getUnlinkedMessage", () => {
  it("should show the empty state when the booking has no flight number", () => {
    expect(getUnlinkedMessage(null, null)).toBe("No flight is linked to this booking.");
    expect(getUnlinkedMessage(undefined, undefined)).toBe("No flight is linked to this booking.");
    expect(getUnlinkedMessage("", null)).toBe("No flight is linked to this booking.");
  });

  it("should say the flight was not found and that the arrival can be entered by hand", () => {
    expect(getUnlinkedMessage("NOPE1", "not_found")).toBe(
      "Flight NOPE1 was not found. Operations can enter the arrival by hand.",
    );
  });

  it("should say the flight is not linked yet when the lookup did not run", () => {
    expect(getUnlinkedMessage("VN123", null)).toBe("Flight VN123 is not linked yet.");
  });
});

const FLIGHT: BookingFlight = {
  flight_number: "EK203",
  status: "scheduled",
  terminal: "3",
  scheduled_arrival_at: "2026-10-24T12:30:00.000Z",
  estimated_arrival_at: "2026-10-24T11:45:00.000Z",
  actual_arrival_at: null,
  delay_minutes: null,
  last_synced_at: new Date().toISOString(),
};

const render = (props: Partial<Parameters<typeof BookingFlightPanel>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(BookingFlightPanel, {
      flight: FLIGHT,
      timeZone: "Asia/Dubai",
      city: "Dubai",
      ...props,
    }),
  );

describe("BookingFlightPanel (VI-F02-S02)", () => {
  it("should show the early banner with the moved deadline, as the design draws it", () => {
    const html = render({
      deadlineAt: "2026-10-24T11:15:00.000Z",
      pickupAt: "2026-10-24T12:45:00.000Z",
    });

    expect(html).toContain("ARRIVING 45 MINUTES EARLY");
    expect(html).toContain("EK203 · Estimated 15:45 GST.");
    expect(html).toContain("Installation deadline moved to 15:15 GST.");
    expect(html).toContain("EK203 · Dubai arrival");
    expect(html).toContain("16:30 · 24 Oct 2026");
    expect(html).toContain("Early 45 min");
  });

  it("should not say the deadline moved when it is still the base deadline or there is none", () => {
    const base = render({
      deadlineAt: "2026-10-24T11:15:00.000Z",
      pickupAt: "2026-10-24T12:15:00.000Z",
    });
    const none = render();

    expect(base).toContain("15:15 GST");
    expect(base).not.toContain("deadline moved");
    expect(none).not.toContain("deadline moved");
    expect(none).toContain("Installation deadline");
  });

  it("should show only the timing pill, not the status badge, for a flight that is early", () => {
    expect(render()).not.toContain(">Scheduled<");
  });

  it("should show the arrival and stop calling the times stale when the flight has landed", () => {
    const html = render({
      flight: {
        ...FLIGHT,
        status: "landed",
        actual_arrival_at: "2026-10-24T11:40:00.000Z",
        last_synced_at: "2026-10-23T08:00:00.000Z",
      },
    });

    expect(html).toContain("Arrived · Asia/Dubai");
    expect(html).toContain("15:40 · 24 Oct 2026");
    expect(html).toContain("Landed: this flight is no longer refreshed.");
    expect(html).not.toContain("Times may be wrong");
    expect(html).not.toContain("flight-banner");
  });

  it("should still say the times may be wrong for an old sync of a flight that has not landed", () => {
    const html = render({ flight: { ...FLIGHT, last_synced_at: "2026-10-23T08:00:00.000Z" } });

    expect(html).toContain("Times may be wrong");
  });
});

describe("BookingFlightPanel early arrival alert (VI-F02-S04)", () => {
  it("should show the alert as soon as the flight is 15 minutes early (AC01, AC03)", () => {
    const html = render({
      flight: { ...FLIGHT, estimated_arrival_at: "2026-10-24T12:15:00.000Z" },
    });

    expect(html).toContain("ARRIVING 15 MINUTES EARLY");
  });

  it("should show no alert for an arrival less than 15 minutes early (AC01)", () => {
    const html = render({
      flight: { ...FLIGHT, estimated_arrival_at: "2026-10-24T12:16:00.000Z" },
    });

    expect(html).not.toContain("ARRIVING");
    expect(html).not.toContain("flight-banner");
    expect(html).toContain("On time");
  });

  it("should clear the alert and the moved deadline when the estimate moves back to the schedule (AC04)", () => {
    const html = render({
      flight: { ...FLIGHT, estimated_arrival_at: FLIGHT.scheduled_arrival_at },
      deadlineAt: "2026-10-24T11:30:00.000Z",
      pickupAt: "2026-10-24T12:30:00.000Z",
    });

    expect(html).not.toContain("ARRIVING");
    expect(html).not.toContain("deadline moved");
    expect(html).toContain("15:30 GST");
  });
});

describe("BookingFlightPanel flight update history (VI-F02-T01)", () => {
  const HISTORY = {
    error: false,
    items: [
      {
        id: "u-1",
        source: "provider" as const,
        occurred_at: "2026-10-24T10:02:00.000Z",
        changes: [{ field: "estimated_arrival_at" as const, from: null, to: "2026-10-24T11:45:00Z" }],
      },
    ],
  };

  it("should show the history card under the flight card (AC01)", () => {
    const html = render({ history: HISTORY });

    expect(html).toContain("Flight update history");
    expect(html.indexOf("booking-flight-card")).toBeLessThan(html.indexOf("flight-update-history"));
    expect(html).toContain("14:02 · Provider — Estimated arrival updated to 15:45 GST");
  });

  it("should still show the flight card when the history cannot load (AC05)", () => {
    const html = render({ history: { items: [], error: true } });

    expect(html).toContain("EK203 · Dubai arrival");
    expect(html).toContain("Flight update history");
    expect(html).toContain('role="alert"');
  });

  it("should show an empty state in the history card when the flight has no history (AC04)", () => {
    const html = render({ history: { items: [], error: false } });

    expect(html).toContain("No flight updates yet.");
    expect(html).not.toContain('role="alert"');
  });

  it("should not show a history card when none is given", () => {
    expect(render()).not.toContain("Flight update history");
  });

  it("should not show a history card for a booking with no linked flight", () => {
    const html = render({ flight: null, history: HISTORY });

    expect(html).toContain("No flight is linked to this booking.");
    expect(html).not.toContain("Flight update history");
  });
});


describe("BookingFlightPanel cancelled or diverted (VI-F02-S06)", () => {
  it("should show the cancelled banner with the action for operations and no early banner", () => {
    const html = render({ flight: { ...FLIGHT, status: "cancelled" } });

    expect(html).toContain("FLIGHT CANCELLED");
    expect(html).toContain("Operations: replan this booking.");
    expect(html).toContain('data-kind="cancelled"');
    expect(html).not.toContain("ARRIVING");
  });

  it("should show the diverted banner", () => {
    expect(render({ flight: { ...FLIGHT, status: "diverted" } })).toContain("FLIGHT DIVERTED");
  });

  it("should show no flag for a flight that is on schedule", () => {
    expect(render({ flight: { ...FLIGHT, status: "scheduled" } })).not.toContain("replan");
  });
});

describe("BookingFlightPanel manual arrival (VI-F02-S07)", () => {
  const MANUAL: BookingFlight = {
    ...FLIGHT,
    manual_entered_at: "2026-10-24T10:00:00.000Z",
    manual_reason: "Passenger called the desk",
  };

  it("should mark the arrival as Manual with the time and the reason it was entered", () => {
    const html = render({ flight: MANUAL });

    expect(html).toContain('data-slot="flight-manual-badge"');
    expect(html).toContain("Manual");
    expect(html).toContain("Entered by hand");
    expect(html).toContain("Passenger called the desk");
    expect(html).toContain("Manual entry");
    expect(html).not.toContain("Provider sync");
  });

  it("should show no Manual mark for data from the provider", () => {
    const html = render();

    expect(html).not.toContain("flight-manual-badge");
    expect(html).not.toContain("Entered by hand");
    expect(html).toContain("Provider sync");
  });

  it("should show the button to enter an arrival only to a person who may enter it", () => {
    expect(render({ manualEntry: { bookingId: "b-1" } })).toContain("Enter arrival by hand");
    expect(render()).not.toContain("Enter arrival by hand");
  });

  it("should offer the button when the provider did not know the number, and not when the booking has no number", () => {
    const unknown = render({ flight: null, flightNumber: "NOPE1", lookupStatus: "not_found", manualEntry: { bookingId: "b-1" } });
    const none = render({ flight: null, flightNumber: null, lookupStatus: null, manualEntry: { bookingId: "b-1" } });

    expect(unknown).toContain("Enter arrival by hand");
    expect(none).not.toContain("Enter arrival by hand");
  });

  it("should not offer the button to a person who may not, even when the provider did not know the number", () => {
    const html = render({ flight: null, flightNumber: "NOPE1", lookupStatus: "not_found" });

    expect(html).toContain("Operations can enter the arrival by hand");
    expect(html).not.toContain("Enter arrival by hand");
  });
});
